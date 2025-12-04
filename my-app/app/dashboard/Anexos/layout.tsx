"use client";
import { ReactNode } from "react";
import Head from "next/head"; // Import next/head to manage the head element
import "../../globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Use the Head component for <head> contents */}
      <Head>
        <title>S.G.D. Hospital - Firma Digital</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main suppressHydrationWarning>
        {children}
        
        {/* COMPONENTE OBLIGATORIO PARA RE-FIRMA (NO BORRAR) */}
        <div id="addComponent" style={{ display: 'none' }}></div>
      </main>
    </>
  );
}
