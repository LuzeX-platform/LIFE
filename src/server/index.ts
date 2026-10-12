import "dotenv/config";
import { bouwApp } from "./app.js";

const app = await bouwApp();
app.listen({ port: Number(process.env.PORT ?? 4000), host: "0.0.0.0" }, err => {
  if (err) { app.log.error(err); process.exit(1); }
});
