import { createSwaggerSpec } from "next-swagger-doc";

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: "/src/app/api/",
    definition: {
      openapi: "3.0.0",
      info: {
        title: "iShortn API Documentation",
        version: "1.0",
        description: "This is the API documentation for iShortn.",
        contact: {
          name: "iShortn",
          url: "https://ishortn.ink",
          email: "kel.amoaba@gmail.com",
        },
      },
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: "apiKey",
            description: "API Key",
            name: "x-ishortn-key",
            in: "header",
          },
        },
      },
      security: [
        {
          ApiKeyAuth: [],
        },
      ],
    },
  });
  return spec;
};
