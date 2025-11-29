import { findByProps } from "@vendetta/metro";
import { before } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import RNFS from "react-native-fs";

// Generates waveform (32 buckets like Discord)
async function generateWaveform(filePath: string): Promise<string> {
    const file = await RNFS.readFile(filePath, "base64");
    const buffer = Buffer.from(file, "base64");

    // Extremely small PCM peak extractor (Discord-like 32 samples)
    const samples = 32;
    const peaks = new Array(samples).fill(0);
    const step = Math.floor(buffer.length / samples);

    for (let i = 0; i < samples; i++) {
        let peak = 0;
        for (let j = 0; j < step; j++) {
            peak = Math.max(peak, Math.abs(buffer[i * step + j] - 128));
        }
        peaks[i] = Math.min(255, Math.floor((peak / 128) * 255));
    }

    return Buffer.from(peaks).toString("base64");
}

async function getDuration(filePath: string): Promise<number> {
    // naive but effective for ogg/opus (reads granule position)
    const file = await RNFS.readFile(filePath, "base64");
    const buffer = Buffer.from(file, "base64");

    const granule = buffer.readUInt32LE(buffer.length - 8);
    return granule / 48000; // opus sample rate
}

async function transform(item: any) {
    if (!item?.mimeType?.startsWith("audio")) return;

    const filePath = item.filepath ?? item.uri;
    if (!filePath) return;

    const duration = await getDuration(filePath);
    const waveform = await generateWaveform(filePath);

    item.mimeType = "audio/ogg";
    item.durationSecs = duration;
    item.waveform = waveform;
}

export default () => {
    const patches: (() => void)[] = [];

    const applyPatch = (method: string) => {
        try {
            const module = findByProps(method);

            const unpatch = before(method, module, async (args) => {
                const upload = args[0];
                if (!storage.sendAsVM || upload.flags === 8192) return;

                const item = upload.items?.[0] ?? upload;
                if (!item?.mimeType?.startsWith("audio")) return;

                await transform(item);

                upload.flags = 8192;
            });

            patches.push(unpatch);
        } catch {}
    };

    applyPatch("uploadLocalFiles");
    applyPatch("CloudUpload");

    return () => patches.forEach((u) => u());
};
