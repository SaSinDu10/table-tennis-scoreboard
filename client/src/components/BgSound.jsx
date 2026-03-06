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

            if (key === "i") playIPL();
            if (key === "e") playEmotion();
            if (key === "p") playPuluwanda();
            if (key === "d") playSnoop();
            if (key === "k") playKaradare();
            if (key === "t") playTrumpt();
            if (key === "a") playAsahane();
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
        isSoundEnabled]);

    return null;
};

export default BgSound;