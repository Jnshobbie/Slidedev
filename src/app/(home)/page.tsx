"use client";

import { ProjectForm } from "@/modules/home/ui/components/project-form";
import { ProjectsList } from "@/modules/home/ui/components/projects-list";
import Image from "next/image";
import React from "react";

const Page = () => {
  return (
    <div
      className="flex flex-col max-w-5xl mx-auto w-full"
      style={{ color: "#FFFFFF" }}
    >
      <section
        className="space-y-6 py-[16vh] 2xl:py-48"
        style={{ textAlign: "center" }}
      >
        <div className="flex flex-col items-center">
          <Image src="/logo.png" alt="Slide" width={50} height={50} className="block" />
        </div>

        <h1
          style={{
            fontSize: 45,
            fontWeight: 700,
            lineHeight: 1.05,
            color: "#FFFFFF",
            margin: 0,
            fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
          }}
        >
          Build something with <span style={{ color: "#00C6FF" }}>Slide</span>
        </h1>

        <p
          className="text-lg md:text-xl"
          style={{ color: "#BFC9D7", marginTop: 8, maxWidth: 820, marginLeft: "auto", marginRight: "auto" }}
        >
          Create apps and websites by chatting with AI
        </p>

        <div className="max-w-3xl mx-auto w-full mt-8 md:mt-10">
          <ProjectForm />
        </div>
      </section>

      <ProjectsList />
    </div>
  );
};

export default Page;
