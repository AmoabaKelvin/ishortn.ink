import prisma from "@/db";

import { generateShortLink } from "./";

export const checkShortURLIsAvailableForProject = async (
  shortUrl: string,
  projectID: number,
): Promise<boolean> => {
  const project = await prisma.dynamicLink.findUnique({
    where: {
      id: projectID,
    },
    include: {
      childLinks: {
        where: {
          shortLink: shortUrl,
        },
      },
    },
  });

  if (!project) {
    return false;
  }

  if (project.childLinks.length === 0) {
    return true;
  }

  return false;
};
export const generateShortLinkForProject = async (
  longURL: string,
  projectID: number,
): Promise<string> => {
  const generatedShortLink = await generateShortLink();

  // now we check if the url is already in the project, if so, we generate a new one
  const isAvailable = await checkShortURLIsAvailableForProject(
    generatedShortLink,
    projectID,
  );

  if (!isAvailable) {
    return generateShortLinkForProject(longURL, projectID);
  }

  return generatedShortLink;
};
