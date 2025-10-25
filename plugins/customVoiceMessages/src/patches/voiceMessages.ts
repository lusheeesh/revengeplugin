import { findByProps } from "@vendetta/metro";
import { before } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

// Generate waveform based on audio buffer
async function generateWaveform(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const channelData = audioBuffer.getChannelData(0);
    const samples = 64; // Discord’s typical number of bars
    const blockSize = Math.floor(channelData.length / samples);
    const waveform = [];

    for (let i = 0; i < samples; i++) {
        const blockStart = i * blockSize;
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[blockStart + j] || 0);
        }
        waveform.push(Math.min(1, sum / blockSize * 10)); // normalize amplitude
    }

    // Discord stores waveform as a base64 string of 8-bit values
    const uint8 = new Uint8Array(waveform.map(v => Math.floor(v * 255)));
    return btoa(String.fromCharCode(...uint8));
}

// Transform upload item into a proper voice message format
async function transformAudioItem(item: any) {
    if (!item?.file || !item.mimeType?.startsWith("audio")) return;

    const file = item.file as File;
    const duration = await new Promise<number>((resolve) => {
        const audio = new Audio(URL.createObjectURL(file));
        audio.addEventListener("loadedmetadata", () => {
            resolve(audio.duration || 0);
            URL.revokeObjectURL(audio.src);
        });
        audio.addEventListener("error", () => resolve(0));
    });

    const waveform = await generateWaveform(file);

    item.mimeType = "audio/ogg";
    item.waveform = waveform;
    item.durationSecs = duration || 1;
}

export default () => {
    const unpatches: (() => void)[] = [];

    const patch = (method: string) => {
        const module = findByProps(method);
        if (!module || typeof module[method] !== "function") return;

        const unpatch = before(method, module, async (args: any[]) => {
            const upload = args?.[0];
            if (!upload || !storage.sendAsVM || upload.flags === 8192) return;

            const item = upload.items?.[0] ?? upload;
            if (item?.mimeType?.startsWith("audio")) {
                await transformAudioItem(item);
                upload.flags = 8192;
            }
        });

        unpatches.push(unpatch);
    };

    patch("uploadLocalFiles");
    patch("CloudUpload");

    return () => unpatches.forEach((u) => u());
};
