import { inngest } from "./client";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    // this is a download movie from utorent step
    await step.sleep("wait-a-moment", "30s");

    // this is a translating step
    await step.sleep("wait-a-moment", "10s");
  
    // this a summary step
    await step.sleep("wait-a-moment", "5s");
    return { message: `Hello ${event.data.email}!` };
  },
); 