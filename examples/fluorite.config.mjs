import { defineConfig } from "fluorite";

export default defineConfig({
  include: ["docs/**/*.md"],
  rules: (fm) => {
    fm.key("title").required().type("string").lengthMin(10);
    fm.key("tags").required().type("array").not.has("ng");
  },
});
