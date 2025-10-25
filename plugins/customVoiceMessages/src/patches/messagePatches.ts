import { before } from "@vendetta/patcher";
import { FluxDispatcher } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";

/**
 * ✅ Generate a pseudo-realistic waveform if the original message lacks one.
 * (Optionally replaced later with a real waveform generator if file accessible.)
 */
function generatePlaceholderWaveform(): string {
    const bars = 64;
    const values = new Uint8Array(bars);
    for (let i = 0; i < bars; i++) {
        values[i] = Math.floor(Math.random() * 200) + 30; // varied waveform
    }
    return btoa(String.fromCharCode(...values));
}

/**
 * ✅ Safely transforms a message object’s audio attachments into proper VM-style.
 */
function transformMessageToVoice(message: any) {
    if (!message?.attachments?.length) return;

    let modified = false;
    for (const attachment of message.attachments) {
        if (!attachment?.content_type?.startsWith?.("audio")) continue;

        if (!attachment.waveform)
            attachment.waveform = generatePlaceholderWaveform();
        if (!attachment.duration_secs)
            attachment.duration_secs = Math.floor(Math.random() * 10) + 20; // 20–30s fallback

        modified = true;
    }

    if (modified) {
        message.flags = (message.flags ?? 0) | 8192; // Mark as voice message
    }
}

/**
 * ✅ Creates a generic patch handler for the given event name.
 */
function createMessagePatch(eventName: string) {
    const handler = FluxDispatcher._actionHandlers._computeOrderedActionHandlers(eventName)
        .find(i => i.name === "MessageStore");

    if (!handler) return () => {};

    return before("actionHandler", handler, (args: any[]) => {
        if (!storage.allAsVM) return;

        const data = args?.[0];
        if (!data) return;

        const messages = data.messages ?? [data.message];
        if (!messages) return;

        for (const msg of messages) {
            if (msg.flags === 8192) continue;
            transformMessageToVoice(msg);
        }
    });
}

/**
 * ✅ Exported patch creators
 */
export const msgSuccess = () => createMessagePatch("LOAD_MESSAGES_SUCCESS");
export const msgCreate  = () => createMessagePatch("MESSAGE_CREATE");
export const msgUpdate  = () => createMessagePatch("MESSAGE_UPDATE");
