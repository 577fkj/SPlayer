import request from "@/utils/request";

/**
 * 获取用户账号信息
 */
export const userAccount = () => {
  return request({
    url: "/user/account",
    params: {
      timestamp: Date.now(),
    },
  });
};

// 获取用户详情
export const userDetail = (uid: number) => {
  return request({
    url: "/user/detail",
    params: {
      uid,
      timestamp: Date.now(),
    },
  });
};

// 获取用户等级信息
export const userLevel = () => {
  return request({
    url: "/user/level",
    params: {
      timestamp: Date.now(),
    },
  });
};

// 获取用户订阅信息，包括歌单、收藏、MV 和 DJ 数量
export const userSubcount = () => {
  return request({
    url: "/user/subcount",
    params: {
      timestamp: Date.now(),
    },
  });
};

// 获取用户歌单
export const userPlaylist = (limit: number = 50, offset: number = 0, uid: number) => {
  return request({
    url: "/user/playlist",
    params: {
      uid,
      limit,
      offset,
      timestamp: Date.now(),
    },
  });
};

// 获取用户收藏专辑
export const userAlbum = (limit: number = 50, offset: number = 0) => {
  return request({
    url: "/album/sublist",
    params: {
      limit,
      offset,
      timestamp: Date.now(),
    },
  });
};

// 获取用户收藏歌手
export const userArtist = (limit: number = 50, offset: number = 0) => {
  return request({
    url: "/artist/sublist",
    params: {
      limit,
      offset,
      timestamp: Date.now(),
    },
  });
};

// 获取用户收藏 MV
export const userMv = (limit: number = 50, offset: number = 0) => {
  return request({
    url: "/mv/sublist",
    params: {
      limit,
      offset,
      timestamp: Date.now(),
    },
  });
};

// 获取用户收藏电台
export const userDj = (limit: number = 50, offset: number = 0) => {
  return request({
    url: "/dj/sublist",
    params: {
      limit,
      offset,
      timestamp: Date.now(),
    },
  });
};

// 获取用户喜欢的音乐
export const userLike = (uid: number) => {
  return request({
    url: "/likelist",
    params: {
      uid,
      timestamp: Date.now(),
    },
  });
};

// 听歌打卡
export const scrobble = (id: number, sourceid?: number, time?: number) => {
  return request({
    url: "/scrobble",
    params: {
      id,
      sourceid,
      time,
      timestamp: Date.now(),
    },
  });
};

export interface ScrobbleV1Params {
  id: number;
  time: number;
  sourceid?: number;
  source?: string;
  name?: string;
  artist?: string;
  bitrate?: number;
  level?: string;
  total?: number;
  cookie?: string;
}

// 听歌打卡 V2
export const scrobbleV1 = (params: ScrobbleV1Params) => {
  return request({
    url: "/scrobble/v1",
    params: {
      ...params,
      timestamp: Date.now(),
    },
  });
};

export type NeteasePlayMode = "list_loop" | "single_loop" | "random" | "order";

export interface SubmitPlayStateParams {
  id: number;
  sessionId?: string;
  progress?: number;
  playMode?: NeteasePlayMode;
  type?: "song";
}

// 提交歌曲播放状态
export const submitPlayState = (params: SubmitPlayStateParams) => {
  return request({
    url: "/relay/play/state/submit",
    params: {
      ...params,
      timestamp: Date.now(),
    },
  });
};

// 每日签到
export const dailySignin = (type: 0 | 1 = 1) => {
  return request({
    url: "/daily_signin",
    params: {
      type,
      timestamp: Date.now(),
    },
  });
};

// 获取签到进度
export const signinProgress = (moduleId = "1207signin-1207signin") => {
  return request({
    url: "/signin/progress",
    params: {
      moduleId,
      timestamp: Date.now(),
    },
  });
};

// 获取云贝签到信息
export const yunbei = () => {
  return request({
    url: "/yunbei",
    params: {
      timestamp: Date.now(),
    },
  });
};

// 获取云贝今日签到信息
export const yunbeiToday = () => {
  return request({
    url: "/yunbei/today",
    params: {
      timestamp: Date.now(),
    },
  });
};

// 云贝签到
export const yunbeiSign = () => {
  return request({
    url: "/yunbei/sign",
    params: {
      timestamp: Date.now(),
    },
  });
};

// 获取云贝账户信息
export const yunbeiInfo = () => {
  return request({
    url: "/yunbei/info",
    params: {
      timestamp: Date.now(),
    },
  });
};
