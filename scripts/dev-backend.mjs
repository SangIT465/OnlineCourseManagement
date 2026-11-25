import { createServer } from "node:net";

function portInUse(port, host) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") resolve(true);
      else if (["EAFNOSUPPORT", "EADDRNOTAVAIL"].includes(error.code)) resolve(false);
      else reject(error);
    });
    server.listen({ port, host, exclusive: true }, () => server.close(() => resolve(false)));
  });
}

// Visual Studio and the combined dev command share the API's localhost port.
// Reuse a running CourseFlow API without taking ownership of its process.
export async function inspectBackend(port = 5106) {
  const occupied = await Promise.all([portInUse(port, "127.0.0.1"), portInUse(port, "::1")]);
  if (!occupied.some(Boolean)) return "start";

  try {
    const signal = AbortSignal.timeout(3000);
    const origin = `http://localhost:${port}`;
    const response = await fetch(origin + "/", { signal, redirect: "error" });
    if (!response.ok || (await response.json()).name !== "CourseFlow API") throw new Error("Different application");
    const health = await fetch(origin + "/health", { signal, redirect: "error" });
    await health.text();
    if (!health.ok) throw new Error("API is not healthy");
    return "reuse";
  } catch {
    throw new Error(
      `Backend port ${port} is already in use, but a running CourseFlow API could not be verified. ` +
      "Stop the application using this port, or wait for the API in Visual Studio to finish starting and run npm run dev again.",
    );
  }
}
