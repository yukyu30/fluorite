import { defineConfig } from "fluorite";

// Canonical tag vocabulary — anything outside this set is a typo / drift.
const TAGS = ["ok", "release", "blog", "news"];

export default defineConfig({
  include: ["docs/**/*.md"],
  rules: (fm) => {
    fm.key("title").required().type("string").lengthMin(10);
    fm.key("tags").required().type("array").subsetOf(TAGS);
  },
});
