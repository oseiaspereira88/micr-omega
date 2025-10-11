export default {
  async fetch(request: Request): Promise<Response> {
    return new Response("MicrΩ worker placeholder", {
      headers: { "content-type": "text/plain" }
    });
  }
};
