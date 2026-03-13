// src/components/BgSound.jsx

import { useEffect, useState } from "react";
import useSound from "use-sound";

import iplSound from "../assets/sounds/iplSound.mp3";
import emotionSound from "../assets/sounds/emotionalDamSound.mp3";
import puluwandaSound from "../assets/sounds/puluwandaSound.mp3";
import snoopDog from "../assets/sounds/snoopDog.mp3";
import visalaKaradare from "../assets/sounds/visalaKaradare.mp3";
import tataaTrumpt from "../assets/sounds/tataaTrumpt.mp3";
import asahane from "../assets/sounds/asahane.mp3";
import kumara from "../assets/sounds/kumara.mp3";
import clock from "../assets/sounds/clock.mp3";
import fart from "../assets/sounds/fart.mp3";
import trombone from "../assets/sounds/trombone.mp3";
import wooaah from "../assets/sounds/wooaah.mp3";

// --- Accept the 'isSoundEnabled' prop from App.jsx ---
const BgSound = ({ isSoundEnabled }) => {
    const [audioUnlocked, setAudioUnlocked] = useState(false);

    const [playIPL] = useSound(iplSound, { volume: 0.8 });
    const [playEmotion] = useSound(emotionSound, { volume: 0.8 });
    const [playPuluwanda] = useSound(puluwandaSound, { volume: 0.8 });
    const [playSnoop] = useSound(snoopDog, { volume: 0.8 });
    const [playKaradare] = useSound(visalaKaradare, { volume: 0.8 });
    const [playTrumpt] = useSound(tataaTrumpt, { volume: 0.8 });
    const [playAsahane] = useSound(asahane, { volume: 0.8 });
    const [playKumara] = useSound(kumara, { volume: 0.8 });
    const [playClock] = useSound(clock, { volume: 1.2 });
    const [playFart] = useSound(fart, { volume: 0.8 });
    const [playTrombone] = useSound(trombone, { volume: 0.8 });
    const [playWooaah] = useSound(wooaah, { volume: 0.8 });

    // This useEffect for unlocking audio remains the same.
    useEffect(() => {
        const unlockAudio = () => {
            setAudioUnlocked(true);
        };

        window.addEventListener("click", unlockAudio, { once: true });

        return () => {
            window.removeEventListener("click", unlockAudio);
        };
    }, []);

    // Keyboard listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isSoundEnabled || !audioUnlocked) return;
            if (e.repeat) return;

            const key = e.key.toLowerCase();

            if (key === "a") playIPL();
            if (key === "c") playClock();
            if (key === "d") playSnoop();
            if (key === "e") playEmotion();
            if (key === "f") playFart();
            if (key === "k") playKaradare();
            if (key === "m") playAsahane();
            if (key === "p") playPuluwanda();
            if (key === "q") playKumara();
            if (key === "t") playTrumpt();
            if (key === "v") playTrombone();
            if (key === "w") playWooaah();
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [audioUnlocked, 
        playIPL, 
        playEmotion, 
        playPuluwanda, 
        playSnoop, 
        playKaradare, 
        playTrumpt, 
        playAsahane, 
        playKumara,
        playClock,
        playFart,
        playTrombone,
        playWooaah,
        isSoundEnabled]);

    return null;
};

export default BgSound;