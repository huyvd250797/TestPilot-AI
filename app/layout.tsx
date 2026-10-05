import type { Metadata } from "next"; import "./globals.css";
export const metadata:Metadata={title:"AI QA Pilot",description:"Black-box AI test planning and execution control plane"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body>{children}</body></html>}