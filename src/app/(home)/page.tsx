import { ProjectForm } from "@/modules/home/ui/components/project-form";
import { ProjectsList } from "@/modules/home/ui/components/projects-list";
import Image from "next/image";

const Page = () => {
  return (
    <div className="flex flex-col max-w-5xl mx-auto w-full">
      <section className="space-y-6 py-[16vh] 2xl:py-48">
        <div className="flex flex-col items-center">
          <Image
            src="/logo.png"
            alt="Slide"
            width={50}
            height={50}
            className="block"
          />
        </div>
        <h1
          style={{ fontSize: "45px", fontWeight: 700 }}
          className="text-center font-sans"
        >
          Build something with Slide
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground text-center">
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