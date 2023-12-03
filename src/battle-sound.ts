
export class BattleBGM {
	/**
	 * May be shared with other BGM objects: every battle has its own BattleBGM
	 * object, but two battles with the same music will have the same HTMLAudioElement
	 * object.
	 */
	sound?: HTMLAudioElement;
	url: string;
	timer: number | undefined = undefined;
	loopstart: number;
	loopend?: number;
    loop?: boolean;
    prism?: boolean;
	/**
	 * When multiple battles with BGM are open, they will be `isPlaying`, but only the
	 * first one will be `isActuallyPlaying`. In addition, muting volume or setting
	 * BGM volume to 0 will set `isActuallyPlaying` to false.
	 */
	isPlaying = false;
	isActuallyPlaying = false;
	/**
	 * The sound should be rewound when it next plays.
	 */
	willRewind = true;
	constructor(url: string, loopstart: number, loopend?: number, loop?: boolean, prism?: boolean) {
		this.url = url;
		this.loopstart = loopstart;
		this.loopend = loopend;
        this.loop = loop;
        this.prism = prism;
	}
	play() {
		this.willRewind = true;
		this.resume();
	}
	resume() {
		this.isPlaying = true;
		this.actuallyResume();
	}
	pause() {
		this.isPlaying = false;
		this.actuallyPause();
		BattleBGM.update();
	}
	stop() {
		this.pause();
		this.willRewind = true;
	}
	destroy() {
		BattleSound.deleteBgm(this);
		this.pause();
	}
    async checkMp3Duration(mp3file) {
      try {
        let duration;
        // Load an audio file
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        const response = await fetch(mp3file.replace('github.com/Petuuuhhh/Yak-Heaven-Client/raw', 'raw.githubusercontent.com/Petuuuhhh/Yak-Heaven-Client'));
        // Decode it
        buffer = await audioContext.decodeAudioData(await response.arrayBuffer()).then(
            function(value) {
                duration = value.duration;
            },
        );
        if (duration) return duration;
      } catch (err) {
        console.error(`Unable to fetch the audio file. Error: ${err.message}`);
      }
    }
	async actuallyResume() {
		if (this !== BattleSound.currentBgm()) return;
		if (this.isActuallyPlaying) return;

		if (!this.sound) this.sound = BattleSound.getSound(this.url, this.loop, this.prism);
		if (!this.sound) return;
		if (this.willRewind) this.sound.currentTime = 0;
		this.willRewind = false;
		this.isActuallyPlaying = true;
		this.sound.volume = BattleSound.bgmVolume / 100;
		this.sound.play();
        let time = await this.checkMp3Duration(this.sound.src);
        this.updateTime(time * 1000);
	}
	actuallyPause() {
		if (!this.isActuallyPlaying) return;
		this.isActuallyPlaying = false;
		this.sound!.pause();
        let time = this.checkMp3Duration(this.sound.src);
        this.updateTime(time * 1000);
	}
	/**
	 * Handles the hard part of looping the sound
	 */
	updateTime(time: number) {
		clearTimeout(this.timer);
		this.timer = undefined;
		if (this !== BattleSound.currentBgm()) return;
		if (!this.sound) return;

		const progress = this.sound.currentTime * 1000;
		if (this.loopend) {
            if (progress > this.loopend - 1000) {
                this.sound.currentTime -= (this.loopend - this.loopstart) / 1000;
            }

            this.timer = setTimeout(() => {
                this.updateTime();
            }, Math.max(this.loopend - progress, 1));
        }
        else  {
            console.log(time, progress);
            if (progress > time - 1000) {
                this.sound.currentTime -= (time - this.loopstart) / 1000;
            }

            this.timer = setTimeout(() => {
                this.updateTime(time);
            }, Math.max(time - progress, 1));
        }
	}

	static update() {
		const current = BattleSound.currentBgm();
		for (const bgm of BattleSound.bgm) {
			if (bgm.isPlaying) {
				if (bgm === current) {
					bgm.actuallyResume();
				} else {
					bgm.actuallyPause();
				}
			}
		}
	}
}

export const BattleSound = new class {
	soundCache: {[url: string]: HTMLAudioElement | undefined} = {};

	bgm: BattleBGM[] = [];

	// options
	effectVolume = 50;
	bgmVolume = 50;
	muted = false;

	getSound(url: string, loop?: boolean, prism?: boolean) {
		if (!window.HTMLAudioElement) return;
		if (this.soundCache[url]) return this.soundCache[url];
		try {
			var sound = document.createElement('audio');
            if (loop) sound.loop = true;
            if (prism) sound.src = 'https://' + Config.routes.yakclient + '/' + url;
			else sound.src = 'https://' + Config.routes.psmain + '/' + url;
			sound.volume = this.effectVolume / 100;
			this.soundCache[url] = sound;
			return sound;
		} catch {}
	}

	playEffect(url: string) {
		this.playSound(url, this.muted ? 0 : this.effectVolume);
	}

	playSound(url: string, volume: number) {
		if (!volume) return;
		const effect = this.getSound(url);
		if (effect) {
			effect.volume = volume / 100;
			effect.play();
		}
	}

	/** loopstart and loopend are in milliseconds */
	loadBgm(url: string, loopstart: number, loopend?: number, replaceBGM?: BattleBGM | null, loop?: boolean, prism?: boolean) {
		if (replaceBGM) {
			replaceBGM.stop();
			this.deleteBgm(replaceBGM);
		}

		const bgm = new BattleBGM(url, loopstart, loopend, loop, prism);
		this.bgm.push(bgm);
		return bgm;
	}
	deleteBgm(bgm: BattleBGM) {
		const soundIndex = BattleSound.bgm.indexOf(bgm);
		if (soundIndex >= 0) BattleSound.bgm.splice(soundIndex, 1);
	}

	currentBgm() {
		if (!this.bgmVolume || this.muted) return false;
		for (const bgm of this.bgm) {
			if (bgm.isPlaying) return bgm;
		}
		return null;
	}

	// setting
	setMute(muted: boolean) {
		muted = !!muted;
		if (this.muted === muted) return;
		this.muted = muted;
		BattleBGM.update();
	}

	loudnessPercentToAmplitudePercent(loudnessPercent: number) {
		// 10 dB is perceived as approximately twice as loud
		let decibels = 10 * Math.log(loudnessPercent / 100) / Math.log(2);
		return Math.pow(10, decibels / 20) * 100;
	}
	setBgmVolume(bgmVolume: number) {
		this.bgmVolume = this.loudnessPercentToAmplitudePercent(bgmVolume);
		BattleBGM.update();
	}
	setEffectVolume(effectVolume: number) {
		this.effectVolume = this.loudnessPercentToAmplitudePercent(effectVolume);
	}
};

if (typeof PS === 'object') {
	PS.prefs.subscribeAndRun(key => {
		if (!key || key === 'musicvolume' || key === 'effectvolume' || key === 'mute') {
			BattleSound.effectVolume = PS.prefs.effectvolume;
			BattleSound.bgmVolume = PS.prefs.musicvolume;
			BattleSound.muted = PS.prefs.mute;
			BattleBGM.update();
		}
	});
}
