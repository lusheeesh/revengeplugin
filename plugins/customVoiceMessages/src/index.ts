import voiceMessages from "./patches/voiceMessages";
import { msgCreate, msgSuccess, msgUpdate } from "./patches/messagePatches";
import download from "./patches/download";
import { storage } from "@vendetta/plugin";

// ✅ Initialize default settings safely
if (typeof storage.sendAsVM !== "boolean") storage.sendAsVM = true;
if (typeof storage.allAsVM !== "boolean") storage.allAsVM = false;

// ✅ Helper: safely register and unregister all patches
const activeUnpatches: (() => void)[] = [];

// Register each patch module and collect their cleanup callbacks
function registerPatches() {
    try {
        activeUnpatches.push(
            voiceMessages(),
            msgCreate(),
            msgSuccess(),
            msgUpdate(),
            download()
        );
    } catch (err) {
        console.error("[Voice Message Plugin] Failed to register patches:", err);
    }
}

// Clean up all active patches
export const onUnload = () => {
    for (const unpatch of activeUnpatches) {
        try {
            unpatch?.();
        } catch (err) {
            console.error("[Voice Message Plugin] Error while unpatching:", err);
        }
    }
    activeUnpatches.length = 0;
};

// Run patch registration immediately
registerPatches();

// Export settings panel
export { default as settings } from "./settings";
