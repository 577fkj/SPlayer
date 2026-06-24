<template>
  <n-popover
    :show="userMenuShow"
    style="padding: 12px; max-width: 280px"
    trigger="manual"
    @clickoutside="userMenuShow = false"
  >
    <template #trigger>
      <div
        class="user"
        :style="{ pointerEvents: userMenuShow ? 'none' : 'auto' }"
        @click="openMenu"
      >
        <div class="avatar">
          <n-avatar
            v-if="dataStore.userLoginStatus"
            :src="dataStore.userData?.avatarUrl"
            fallback-src="/images/avatar.jpg?asset"
            round
          />
          <n-avatar v-else round>
            <SvgIcon name="Person" :depth="3" size="26" />
          </n-avatar>
        </div>
        <n-flex v-if="isDesktop" :wrap="false" class="user-data" size="small">
          <n-text class="name text-hidden">
            {{ dataStore.userLoginStatus ? dataStore.userData.name || "未知用户名" : "未登录" }}
          </n-text>
          <!-- VIP -->
          <img
            v-if="dataStore.userLoginStatus && dataStore.userData.vipType !== 0"
            class="vip-img"
            src="/images/vip.png?asset"
          />
          <SvgIcon :class="['down', { open: userMenuShow }]" name="DropDown" :depth="3" />
        </n-flex>
      </div>
    </template>
    <div class="user-menu" @click="userMenuShow = false">
      <!-- 用户信息 -->
      <n-flex class="user-info" align="center" justify="center" vertical>
        <n-text class="nickname text-hidden">{{ dataStore.userData.name || "未知用户名" }}</n-text>
        <n-flex align="center" size="small">
          <n-tag :bordered="false" size="small" round type="warning">
            Lv.{{ dataStore.userData.level ?? 0 }}
          </n-tag>
          <!-- VIP -->
          <img
            v-if="dataStore.userLoginStatus && dataStore.userData.vipType !== 0"
            class="vip-img"
            src="/images/vip.png?asset"
          />
        </n-flex>
      </n-flex>
      <n-divider />
      <!-- 云贝信息 -->
      <n-flex
        v-if="dataStore.loginType !== 'uid'"
        class="yunbei-info"
        :size="8"
        vertical
        @click.stop
      >
        <n-flex align="center" justify="space-between">
          <n-text class="subtitle" :depth="3">
            <SvgIcon name="Cloud" />
            云贝信息
          </n-text>
          <n-button
            :loading="yunbeiLoading"
            circle
            quaternary
            size="tiny"
            @click.stop="loadYunbeiData(true)"
          >
            <template #icon>
              <SvgIcon name="Refresh" />
            </template>
          </n-button>
        </n-flex>
        <n-grid :cols="3" :x-gap="8">
          <n-grid-item v-for="item in yunbeiStats" :key="item.label">
            <n-flex class="yunbei-item" align="center" vertical>
              <n-text class="value">{{ item.value }}</n-text>
              <n-text :depth="3">{{ item.label }}</n-text>
            </n-flex>
          </n-grid-item>
        </n-grid>
        <n-text v-if="yunbeiTip" class="yunbei-tip" :depth="3">
          {{ yunbeiTip }}
        </n-text>
      </n-flex>
      <n-divider v-if="dataStore.loginType !== 'uid'" />
      <!-- 喜欢数量 -->
      <div v-if="dataStore.loginType !== 'uid'" class="like-num">
        <div
          v-for="(item, index) in userLikeData"
          :key="index"
          class="num-item"
          @click="router.push({ name: item.name })"
        >
          <n-number-animation :from="0" :to="item.value" />
          <n-text :depth="3">{{ item.label }}</n-text>
        </div>
      </div>
      <n-flex v-else align="center" vertical>
        <n-text>UID 登录模式</n-text>
        <n-text :depth="3">部分功能暂不可用</n-text>
      </n-flex>
      <n-divider />
      <!-- 多账号 -->
      <div class="account-list" v-if="dataStore.userLoginStatus && dataStore.loginType !== 'uid'">
        <n-text class="subtitle" :depth="3">切换账号</n-text>
        <div
          v-for="account in otherAccounts"
          :key="account.userId"
          class="account-item"
          @click="handleSwitchAccount(account.userId)"
        >
          <n-avatar :src="account.avatarUrl" round size="small" />
          <div class="account-name text-hidden">{{ account.name }}</div>
          <div class="delete-btn" @click.stop="handleRemoveAccount(account.userId)">
            <SvgIcon name="Close" />
          </div>
        </div>
        <n-button class="add-account" ghost block @click="handleAddAccount">
          <template #icon>
            <SvgIcon name="Add" />
          </template>
          添加账号
        </n-button>
      </div>
      <n-divider v-if="dataStore.userLoginStatus" />
      <!-- 退出登录 -->
      <n-button :focusable="false" class="logout" strong secondary round @click="isLogout">
        <template #icon>
          <SvgIcon name="Power" />
        </template>
        退出登录
      </n-button>
    </div>
  </n-popover>
</template>

<script setup lang="ts">
import { useDataStore } from "@/stores";
import { openUserLogin } from "@/utils/modal";
import { getLoginState } from "@/api/login";
import {
  updateUserData,
  updateSpecialUserData,
  toLogout,
  isLogin,
  refreshLoginData,
  saveCurrentAccount,
  switchAccount,
  removeAccount,
} from "@/utils/auth";
import { useMobile } from "@/composables/useMobile";
import { signinProgress, yunbei, yunbeiInfo, yunbeiToday } from "@/api/user";

const router = useRouter();
const dataStore = useDataStore();

const { isDesktop } = useMobile();

// 用户菜单展示
const userMenuShow = ref<boolean>(false);

interface YunbeiMenuData {
  balance: number | null;
  streak: number | null;
  today: number | null;
  tomorrow: number | null;
  signed: boolean | null;
}

const userYunbeiData = ref<YunbeiMenuData>({
  balance: null,
  streak: null,
  today: null,
  tomorrow: null,
  signed: null,
});
const yunbeiLoading = ref(false);

const getSettledValue = <T,>(result: PromiseSettledResult<T>) => {
  return result.status === "fulfilled" ? result.value : null;
};

const getNestedValue = (source: unknown, keys: string[]) => {
  const stack = [source];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    const data = current as Record<string, unknown>;
    for (const key of keys) {
      if (data[key] !== undefined) return data[key];
    }
    stack.push(...Object.values(data));
  }
  return undefined;
};

const getNumber = (source: unknown, keys: string[]) => {
  const value = getNestedValue(source, keys);
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? null : numberValue;
  }
  return null;
};

const getBoolean = (source: unknown, keys: string[]) => {
  const value = getNestedValue(source, keys);
  return typeof value === "boolean" ? value : null;
};

const displayValue = (value: number | null, suffix = "") => {
  return value === null ? "--" : `${value}${suffix}`;
};

// 加载云贝信息
const loadYunbeiData = async (force = false) => {
  if (yunbeiLoading.value || dataStore.loginType === "uid") return;
  if (!force && userYunbeiData.value.balance !== null) return;
  yunbeiLoading.value = true;
  try {
    const [infoResult, signResult, todayResult, progressResult] = await Promise.allSettled([
      yunbeiInfo(),
      yunbei(),
      yunbeiToday(),
      signinProgress(),
    ]);
    const infoData = getSettledValue(infoResult);
    const signData = getSettledValue(signResult);
    const todayData = getSettledValue(todayResult);
    const progressData = getSettledValue(progressResult);
    const today = getNumber(todayData, ["todayPoint", "point", "amount", "gain"]);
    userYunbeiData.value = {
      balance: getNumber(infoData, ["yunbeiNum", "yunbei", "balance", "pointBalance"]),
      streak: getNumber(signData, ["signInDays", "continuousDays", "continueDays", "signDays"]),
      today,
      tomorrow: getNumber(signData, ["tomorrowPoint", "nextPoint", "nextDayPoint", "nextReward"]),
      signed: today !== null || getBoolean(progressData, ["signed", "todaySigned", "signIn"]),
    };
  } catch (error) {
    console.error("获取云贝信息失败:", error);
  } finally {
    yunbeiLoading.value = false;
  }
};

const yunbeiStats = computed(() => [
  { label: "云贝", value: displayValue(userYunbeiData.value.balance) },
  { label: "连签", value: displayValue(userYunbeiData.value.streak, " 天") },
  { label: "今日", value: displayValue(userYunbeiData.value.today) },
]);

const yunbeiTip = computed(() => {
  const { signed, tomorrow } = userYunbeiData.value;
  const signedText = signed === null ? "签到状态待刷新" : signed ? "今日已签到" : "今日待签到";
  const tomorrowText = tomorrow === null ? "" : `，明日可得 ${tomorrow} 云贝`;
  return `${signedText}${tomorrowText}`;
});

// 开启用户菜单
const openMenu = () => {
  if (dataStore.userLoginStatus) {
    userMenuShow.value = !userMenuShow.value;
    if (userMenuShow.value) loadYunbeiData();
  } else {
    openUserLogin();
  }
};

// 用户喜欢数据
const userLikeData = computed(() => {
  return [
    {
      label: "歌单",
      name: "like-playlists",
      value: dataStore.userLikeData.playlists.length,
    },
    {
      label: "专辑",
      name: "like-albums",
      value: dataStore.userLikeData.albums.length,
    },
    {
      label: "歌手",
      name: "like-artists",
      value: dataStore.userLikeData.artists.length,
    },
  ];
});

// 检查登录状态
const checkLoginStatus = async () => {
  // 若为 UID 登录
  if (dataStore.loginType === "uid") {
    await updateSpecialUserData();
    return;
  }
  // 获取登录状态
  const loginState = await getLoginState();
  // 登录正常
  if (loginState.data?.profile && Object.keys(loginState.data?.profile)?.length) {
    dataStore.userLoginStatus = true;
    // 刷新登录
    await refreshLoginData();
    // 获取用户信息
    await updateUserData();
  }
  // 若还有用户数据，则登录过期
  else if (dataStore.userData.userId !== 0) {
    dataStore.userLoginStatus = false;
    dataStore.userData.userId = 0;
    window.$message.warning("登录已过期，请重新登录", { duration: 2000 });
    openUserLogin();
  }
};

// 其他账号列表（排除当前登录的）
const otherAccounts = computed(() => {
  return dataStore.userList.filter((u) => u.userId !== dataStore.userData.userId);
});

// 切换账号
const handleSwitchAccount = async (userId: number) => {
  userMenuShow.value = false;
  await switchAccount(userId);
};

// 移除账号
const handleRemoveAccount = (userId: number) => {
  removeAccount(userId);
};

// 添加新账号 (保存当前 -> 开启强制登录 -> 成功后自动切换)
const handleAddAccount = async () => {
  // 限制账号数量
  if (dataStore.userList.length >= 3) {
    window.$message.warning("最多只能保留 3 个账号");
    return;
  }

  // 1先保存当前账号状态 (快照)
  saveCurrentAccount();

  userMenuShow.value = false;

  // 打开登录框 (强制模式, 不登出当前用户以保持 cookies 直到新登录成功, 禁用 UID 登录)
  openUserLogin(
    false,
    true,
    async () => {
      // 登录成功回调
      // 此时新 cookies 已设置，store 已更新
      window.$message.loading("正在更新数据...");
      try {
        await updateUserData();
        window.$message.success("登录成功");
        // router.push("/");
      } catch (error) {
        console.error("Login update failed", error);
      }
    },
    true,
  );
};

// 退出登录
const isLogout = () => {
  if (!isLogin()) {
    openUserLogin();
    return;
  }
  window.$dialog.warning({
    title: "退出登录",
    content: "确认退出当前用户登录？",
    positiveText: "确认登出",
    negativeText: "取消",
    onPositiveClick: () => {
      // 退出时保存当前账号，方便下次登录
      saveCurrentAccount();
      toLogout();
    },
  });
};

onBeforeMount(() => {
  checkLoginStatus();
});
</script>

<style lang="scss" scoped>
.user {
  display: flex;
  align-items: center;
  height: 34px;
  border-radius: 25px;
  background-color: rgba(var(--primary), 0.08);
  transition: background-color 0.3s;
  cursor: pointer;
  -webkit-app-region: no-drag;
  .avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    min-width: 38px;
    border-radius: 50%;
    border: 2px solid rgba(var(--primary), 0.28);
    .n-avatar {
      width: 100%;
      height: 100%;
    }
  }
  .user-data {
    display: flex;
    align-items: center;
    padding-left: 8px;
    max-width: 200px;
    .down {
      font-size: 26px;
      margin-right: 4px;
      transition: transform 0.3s;
      &.open {
        transform: rotate(180deg);
      }
    }
  }
  &:hover {
    background-color: rgba(var(--primary), 0.28);
  }
  &:active {
    background-color: rgba(var(--primary), 0.12);
  }
}
.vip-img {
  height: 18px;
}
.user-menu {
  display: flex;
  justify-content: center;
  flex-direction: column;
  .user-info {
    .nickname {
      font-weight: bold;
      max-width: 220px;
    }
    .n-tag {
      height: 18px;
      font-size: 12px;
      pointer-events: none;
    }
  }
  .like-num {
    display: flex;
    justify-content: space-around;
    .num-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      .n-text {
        font-size: 12px;
        font-weight: normal;
        margin-top: 4px;
      }
    }
  }
  .yunbei-info {
    .subtitle {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
    }
    .yunbei-item {
      padding: 8px;
      border-radius: 8px;
      background-color: rgba(var(--primary), 0.06);
      .value {
        font-size: 16px;
        font-weight: bold;
      }
      .n-text:last-child {
        font-size: 12px;
      }
    }
    .yunbei-tip {
      font-size: 12px;
      text-align: center;
    }
  }
  .account-list {
    .subtitle {
      font-size: 12px;
      text-align: center;
      margin-bottom: 8px;
      display: block;
    }
    .account-item {
      display: flex;
      align-items: center;
      padding: 6px 8px;
      margin-bottom: 8px;
      border-radius: 8px;
      cursor: pointer;
      transition: background-color 0.2s;
      position: relative;
      .account-name {
        margin-left: 8px;
        font-size: 13px;
        flex: 1;
      }
      .delete-btn {
        opacity: 0;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        transition:
          background-color 0.2s,
          color 0.2s;
        &:hover {
          background-color: rgba(var(--primary), 0.1);
          color: var(--primary-color);
        }
      }
      &:hover {
        background-color: rgba(var(--primary), 0.08);
        .delete-btn {
          opacity: 1;
        }
      }
    }
    .add-account {
      border-radius: 8px;
    }
  }
  .n-divider {
    margin: 12px 0;
  }
}
</style>
