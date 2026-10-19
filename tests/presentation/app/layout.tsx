// Separate test application, never part of the production app directory.
import '@/app/globals.css';
export const metadata = {title:'Tycoonara district presentation test'};
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="en"><body><header className="topbar"><span className="brand">Tycoonara · presentation fixture</span></header>{children}</body></html>; }
