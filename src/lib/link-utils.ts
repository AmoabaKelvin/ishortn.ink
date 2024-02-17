export const formatLinkAlias = (alias: string) => {
  // If no alias is provided, return null, else, format the alias
  // by trimming it, converting it to lowercase, and replacing
  // spaces with hyphens
  if (!alias) {
    return null;
  }

  return alias.trim().toLowerCase().replace(/\s/g, "-");
};
