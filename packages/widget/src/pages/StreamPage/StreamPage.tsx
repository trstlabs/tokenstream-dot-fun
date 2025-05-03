import { ICONS } from "@/icons";
import { StreamPageHeader } from "./StreamPageHeader";
import { track } from "@amplitude/analytics-browser";
import { MainButton } from "@/components/MainButton";
import { useTheme } from "styled-components";
import { Row } from "@/components/Layout";
import { SmallText } from "@/components/Typography";
import { WaveIcon } from "@/icons/WaveIcon";
import { currentPageAtom, Routes } from "@/state/router";
import { useAtom, useSetAtom } from "jotai";
import { streamSettingsAtom } from "@/state/streamSettings";


export type StreamPageProps = {

};

export const StreamPage = ({

}: StreamPageProps) => {
  const theme = useTheme();
  const [streamSettings, setStreamSettings] = useAtom(streamSettingsAtom);

 // Transform the interval from Atom (seconds) to hours or days
 const streamIntervalInSeconds = streamSettings.interval; // Example interval in seconds (1 day)
 const intervalInDays = streamIntervalInSeconds / 86400;
 const intervalInHours = streamIntervalInSeconds / 3600;
const setCurrentPage = useSetAtom(currentPageAtom);
 // Create the stream settings message
 const streamSettingsMessage = intervalInDays >= 1
   ? `${intervalInDays} day(s)`
   : `${intervalInHours} hour(s)`;

 return (
   <>
     <StreamPageHeader
       leftButton={{
         label: "Back",
         icon: ICONS.thinArrow,
         onClick: () => {
           track("stream page: back button clicked");
           setCurrentPage(Routes.SwapPage);
         },
       }}
       middleButton={{
         label: "Start Streaming",
         icon: ICONS.stream,
         onClick: () => {
           track("stream page: start streaming button clicked");
           setStreamSettings((prev) => ({ ...prev, shouldStream: true }));
           setCurrentPage(Routes.SwapExecutionPage);
         },
       }}
       rightButton={{
         label: "Go to Swap",
         icon: ICONS.swap,
         onClick: () => {
           track("stream page: go to swap button clicked");
           setStreamSettings((prev) => ({ ...prev, shouldStream: false }));
           setCurrentPage(Routes.SwapExecutionPage);
         },
       }}
     />

     <div style={{ padding: '20px', textAlign: 'center' }}>
       <Row justify="center" align="center" gap={15}>
         {/* Stream Icon */}
         <WaveIcon width={50} />
         <div>
           <SmallText textAlign="center">
             Stream Settings
           </SmallText>
           <SmallText textAlign="center">
             Interval: {streamSettingsMessage}
           </SmallText>
         </div>
       </Row>

       <div style={{ marginTop: '20px' }}>
         <SmallText color={theme.brandColor} textAlign="center">
           Do you want to go once or stream?
         </SmallText>
       </div>

       <Row justify="center" align="center" gap={20} style={{ marginTop: '20px' }}>
          {/* Button to go back to swap */}
          <MainButton
           label="Go Once"
           onClick={() => {
             track("stream page: swap button clicked");
             setStreamSettings((prev) => ({ ...prev, shouldStream: false }));
             setCurrentPage(Routes.SwapExecutionPage);
           }}
           icon={ICONS.swap}
         />
         {/* Button to continue */}
         <MainButton
           label="Stream"
           onClick={() => {
             track("stream page: continue button clicked");
             setStreamSettings((prev) => ({ ...prev, shouldStream: true }));
             setCurrentPage(Routes.SwapExecutionPage);
           }}
           icon={ICONS.checkmark}
         />

       
         
       </Row>
     </div>

     {/* <div style={{ marginTop: '20px' }}>
       <GhostButton
         gap={5}
         align="center" 
       
         onClick={() => {
           track("stream page: back button clicked");
           setCurrentPage(Routes.SwapPage);
         }}
         
       >Back</GhostButton>
     </div> */}
   </>
 );
};