import { dailySignin, yunbeiSign } from "@/api/user";
import { useDataStore, useSettingStore } from "@/stores";
import { getCookie } from "@/utils/cookie";

const SIGNIN_KEY_PREFIX = "auto-signin";
let isRunning = false;

const getTodayKey = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const getRecordKey = (name: string, userId: number) => {
  return `${SIGNIN_KEY_PREFIX}:${name}:${userId}`;
};

const isMarkedToday = (name: string, userId: number) => {
  return localStorage.getItem(getRecordKey(name, userId)) === getTodayKey();
};

const markToday = (name: string, userId: number) => {
  localStorage.setItem(getRecordKey(name, userId), getTodayKey());
};

const stringifyResult = (result: unknown) => {
  try {
    return JSON.stringify(result);
  } catch {
    return "";
  }
};

const findCode = (value: unknown): number | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const data = value as Record<string, unknown>;
  if (typeof data.code === "number") return data.code;
  for (const item of Object.values(data)) {
    const code = findCode(item);
    if (code !== undefined) return code;
  }
  return undefined;
};

const isSuccessOrSigned = (result: unknown) => {
  const code = findCode(result);
  const text = stringifyResult(result);
  return code === 200 || text.includes("重复") || text.includes("已签到");
};

const runDailySignin = async (userId: number) => {
  if (isMarkedToday("daily", userId)) return;
  const result = await dailySignin();
  if (isSuccessOrSigned(result)) {
    markToday("daily", userId);
  }
};

const runYunbeiSignin = async (userId: number) => {
  if (isMarkedToday("yunbei", userId)) return;
  const result = await yunbeiSign();
  if (isSuccessOrSigned(result)) {
    markToday("yunbei", userId);
  }
};

// 执行登录后的自动签到任务
export const runAutoSignin = async () => {
  if (isRunning) return;

  const dataStore = useDataStore();
  const settingStore = useSettingStore();
  const userId = dataStore.userData.userId;
  const canSignin =
    dataStore.userLoginStatus && dataStore.loginType !== "uid" && Boolean(getCookie("MUSIC_U"));
  if (!canSignin) return;
  if (!userId) return;

  isRunning = true;
  try {
    const tasks: Promise<void>[] = [];
    if (settingStore.autoSignin) tasks.push(runDailySignin(userId));
    if (settingStore.autoYunbeiSignin) tasks.push(runYunbeiSignin(userId));
    await Promise.allSettled(tasks);
  } finally {
    isRunning = false;
  }
};
