// src/components/BgSound.jsx

import { useEffect, useState } from "react";
import useSound from "use-sound";

import iplSound from "../assets/sounds/iplSound.mp3";
import emotionSound from "../assets/sounds/emotionalDamSound.mp3";
import puluwandaSound from "../assets/sounds/puluwandaSound.mp3";

const BgSound = () => {
    const [audioUnlocked, setAudioUnlocked] = useState(false);

    const [playIPL] = useSound(iplSound, { volume: 0.8 });
    const [playEmotion] = useSound(emotionSound, { volume: 0.8 });
    const [playPuluwanda] = useSound(puluwandaSound, { volume: 0.8 });

    // Unlock audio after first click
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
            if (!audioUnlocked) return;
            if (e.repeat) return;

            const key = e.key.toLowerCase();

            if (key === "a") playIPL();
            if (key === "b") playEmotion();
            if (key === "c") playPuluwanda();
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [audioUnlocked, playIPL, playEmotion, playPuluwanda]);

    return null;
};

export default BgSound;