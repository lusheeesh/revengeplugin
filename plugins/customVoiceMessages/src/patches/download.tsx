import { before, after } from "@vendetta/patcher";
import { getAssetIDByName as getAssetId } from "@vendetta/ui/assets";
import { findByProps } from "@vendetta/metro";
import { findInReactTree } from "@vendetta/utils";
import { React, clipboard } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
import CoolRow from "../components/CoolRow";

const ActionSheet = findByProps("openLazy", "hideActionSheet");
const MediaDownloader = findByProps("downloadMediaAsset");
const { hideActionSheet } = findByProps("hideActionSheet");

/**
 * ✅ Helper: safely get a voice message attachment.
 */
function getVoiceAttachment(message: any) {
    if (!message?.attachments?.length) return null;
    const audio = message.attachments.find(a =>
        a?.content_type?.startsWith?.("audio") || a?.filename?.endsWith?.(".ogg")
    );
    return audio ?? null;
}

export default () =>
    before("openLazy", ActionSheet, (ctx) => {
        const [sheetType, args, actionData] = ctx;
        const message = actionData?.message;

        // Only patch message long-press sheets
        if (args !== "MessageLongPressActionSheet" || !message) return;

        // Lazy-loaded component promise
        sheetType.then((instance) => {
            const unpatch = after("default", instance, (_, comp) => {
                React.useEffect(() => () => unpatch?.(), []); // Clean unpatch on unmount

                // Find the action button list within the sheet
                const buttons = findInReactTree(comp, (x) =>
                    Array.isArray(x) && x[0]?.type?.name === "ButtonRow"
                );
                if (!buttons) return comp;

                const voiceAttachment = getVoiceAttachment(message);
                if (!message.hasFlag?.(8192) || !voiceAttachment) return comp;

                // Insert custom options cleanly (positions adjusted for safety)
                const insertIndex = Math.min(buttons.length, 5);

                const options = [
                    <CoolRow
                        key="vm-download"
                        label="Download Voice Message"
                        icon={getAssetId("ic_download_24px")}
                        onPress={async () => {
                            try {
                                await MediaDownloader.downloadMediaAsset(
                                    voiceAttachment.url,
                                    0
                                );
                            } catch (err) {
                                console.error(
                                    "[VM Download] Failed to download voice message:",
                                    err
                                );
                            } finally {
                                hideActionSheet();
                            }
                        }}
                    />,
                    <CoolRow
                        key="vm-copy"
                        label="Copy Voice Message URL"
                        icon={getAssetId("copy")}
                        onPress={() => {
                            clipboard.setString(voiceAttachment.url);
                            hideActionSheet();
                        }}
                    />,
                ];

                // Insert both buttons back-to-back
                buttons.splice(insertIndex, 0, ...options);

                return comp;
            });
        });
    });
