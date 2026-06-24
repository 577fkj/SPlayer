import {
  scrobbleV1,
  submitPlayState,
  type NeteasePlayMode,
  type ScrobbleV1Params,
} from "@/api/user";
import { useMusicStore, useSettingStore, useStatusStore } from "@/stores";
import type { SongType } from "@/types/main";
import { isLogin } from "@/utils/auth";
import { getPlayerInfoObj } from "@/utils/format";

const REPORT_INTERVAL_SECONDS = 30;
const MIN_SCROBBLE_DURATION_SECONDS = 30;
const SESSION_ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

interface CurrentTrack {
  songId: number;
  sessionId: string;
  sourceId: number | undefined;
  duration: number;
  playedSeconds: number;
  lastProgress: number;
  hasScrobbled: boolean;
  stateReporting: boolean;
  lastStateReportAt: number;
}

const toSeconds = (timeMs?: number): number => {
  if (!Number.isFinite(timeMs) || !timeMs) return 0;
  return Math.max(0, Math.floor(timeMs / 1000));
};

const createSessionId = (): string =>
  Array.from(
    { length: 12 },
    () => SESSION_ID_CHARS[Math.floor(Math.random() * SESSION_ID_CHARS.length)],
  ).join("");

class NeteasePlayReporter {
  private currentTrack: CurrentTrack | null = null;

  public startPlaying(song: SongType, progressMs: number, durationMs: number) {
    if (!this.isReportableSong(song)) {
      this.reset();
      return;
    }

    const duration = toSeconds(durationMs || song.duration);
    const sourceId = this.getSourceId();

    if (!this.currentTrack || this.currentTrack.songId !== song.id) {
      this.currentTrack = {
        songId: song.id,
        sessionId: createSessionId(),
        sourceId,
        duration,
        playedSeconds: 0,
        lastProgress: toSeconds(progressMs),
        hasScrobbled: false,
        stateReporting: false,
        lastStateReportAt: 0,
      };
    } else {
      this.currentTrack.sourceId = sourceId;
      this.currentTrack.duration = duration || this.currentTrack.duration;
      this.currentTrack.lastProgress = toSeconds(progressMs);
    }

    this.reportState(toSeconds(progressMs), true);
  }

  public pause(progressMs: number) {
    this.reportState(toSeconds(progressMs), true);
  }

  public stop(progressMs: number, durationMs: number) {
    if (!this.currentTrack) return;
    const progress = toSeconds(progressMs);
    const duration = toSeconds(durationMs) || this.currentTrack.duration;
    this.updatePlayedSeconds(this.currentTrack, progress);
    this.reportState(progress, true);
    this.reportScrobble(duration);
    this.reset();
  }

  public updateProgress(progressMs: number, durationMs: number) {
    if (!this.currentTrack) return;
    if (!this.isEnabled()) {
      this.reset();
      return;
    }

    const progress = toSeconds(progressMs);
    const duration = toSeconds(durationMs) || this.currentTrack.duration;
    this.currentTrack.duration = duration;
    this.currentTrack.sourceId = this.getSourceId() ?? this.currentTrack.sourceId;
    this.updatePlayedSeconds(this.currentTrack, progress);

    this.reportState(progress);
    this.reportScrobble(duration);
  }

  private reportState(progress: number, force = false) {
    const track = this.currentTrack;
    if (!track || !this.isEnabled()) return;

    const now = Date.now();
    const elapsedSeconds = (now - track.lastStateReportAt) / 1000;
    if (!force && elapsedSeconds < REPORT_INTERVAL_SECONDS) return;
    if (track.stateReporting) return;

    track.stateReporting = true;
    track.lastStateReportAt = now;

    void submitPlayState({
      id: track.songId,
      sessionId: track.sessionId,
      progress,
      playMode: this.getPlayMode(),
      type: "song",
    })
      .then(() => {
        console.log("网易云播放状态已上报", track.songId, progress);
      })
      .catch((error) => {
        console.error("网易云播放状态上报失败", error);
      })
      .finally(() => {
        track.stateReporting = false;
      });
  }

  private reportScrobble(duration: number) {
    const track = this.currentTrack;
    if (!track || track.hasScrobbled || !this.isEnabled()) return;
    if (!this.canScrobble(track.playedSeconds, duration)) return;

    track.hasScrobbled = true;
    const playedSeconds = Math.floor(track.playedSeconds);
    const params = this.getScrobbleParams(track, playedSeconds, duration);

    void scrobbleV1(params)
      .then(() => {
        console.log("网易云听歌打卡已上报", track.songId, playedSeconds);
      })
      .catch((error) => {
        console.error("网易云听歌打卡上报失败", error);
      });
  }

  private getScrobbleParams(
    track: CurrentTrack,
    playedSeconds: number,
    duration: number,
  ): ScrobbleV1Params {
    const settingStore = useSettingStore();
    const musicStore = useMusicStore();
    const info = getPlayerInfoObj(musicStore.playSong);
    const total = duration || playedSeconds;
    const params: ScrobbleV1Params = {
      id: track.songId,
      time: Math.max(1, Math.min(playedSeconds, total || playedSeconds)),
      source: "list",
      level: settingStore.songLevel || "exhigh",
    };

    if (info?.name) params.name = info.name;
    if (info?.artist) params.artist = info.artist;
    if (track.sourceId) params.sourceid = track.sourceId;
    if (total > 0) params.total = total;

    return params;
  }

  private canScrobble(playedSeconds: number, duration: number): boolean {
    const total = duration || playedSeconds;
    if (total <= MIN_SCROBBLE_DURATION_SECONDS) return false;
    const scrobblePoint = Math.min(total / 2, 240);
    return playedSeconds >= scrobblePoint;
  }

  private updatePlayedSeconds(track: CurrentTrack, progress: number) {
    const delta = progress - track.lastProgress;
    if (delta > 0 && delta <= 3) {
      track.playedSeconds += delta;
    }
    track.lastProgress = progress;
  }

  private getPlayMode(): NeteasePlayMode {
    const statusStore = useStatusStore();
    if (statusStore.shuffleMode !== "off") return "random";
    if (statusStore.repeatMode === "one") return "single_loop";
    if (statusStore.repeatMode === "off") return "order";
    return "list_loop";
  }

  private getSourceId(): number | undefined {
    const sourceId = Number(useMusicStore().playPlaylistId);
    if (!Number.isSafeInteger(sourceId) || sourceId <= 0) return undefined;
    return sourceId;
  }

  private isReportableSong(song?: SongType): song is SongType {
    return Boolean(
      this.isEnabled() &&
        song &&
        song.type === "song" &&
        !song.path &&
        song.id &&
        Number.isSafeInteger(song.id),
    );
  }

  private isEnabled(): boolean {
    const settingStore = useSettingStore();
    return settingStore.scrobbleSong && isLogin() === 1;
  }

  private reset() {
    this.currentTrack = null;
  }
}

const neteasePlayReporter = new NeteasePlayReporter();

export default neteasePlayReporter;
