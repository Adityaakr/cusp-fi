const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'pages', 'Markets.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. replace useState for category and subCategory with useSearchParams
content = content.replace('import { useState, useMemo, useEffect, useCallback } from "react";', 'import { useState, useMemo, useEffect, useCallback } from "react";\nimport { useSearchParams } from "react-router-dom";');

content = content.replace('  const [category, setCategory] = useState("All");\n  const [subCategory, setSubCategory] = useState("All");', `  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "All";
  const subCategory = searchParams.get("subCategory") || "All";
  const setCategory = useCallback((cat) => {
    setSearchParams(prev => {
      prev.set("category", cat);
      prev.delete("subCategory");
      return prev;
    }, { replace: true });
  }, [setSearchParams]);
  const setSubCategory = useCallback((tag) => {
    setSearchParams(prev => {
      if (tag === "All") prev.delete("subCategory");
      else prev.set("subCategory", tag);
      return prev;
    }, { replace: true });
  }, [setSearchParams]);`);

// 2. Remove the top categories/subcategories divs and update the layout
content = content.replace(/<div className="hidden lg:flex gap-2 overflow-x-auto pb-3 mb-4">\s*\{categoryTabs\.map\(\(cat\).*?<\/div>\s*}/s, '');
content = content.replace(/\{category !== "All" && subCategoryTabs\.length > 0 && \(\s*<div className="hidden lg:flex gap-2 overflow-x-auto pb-3 mb-4">.*?<\/div>\s*\)\}/s, '');

// The above regexes might be fragile, let's just do it directly using a known string block.

fs.writeFileSync(file, content);
