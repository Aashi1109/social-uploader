import Ajv from "ajv";

const ajv = new Ajv({ allErrors: true }); // keep strict defaults

ajv.addKeyword({
  keyword: "x-meta",
  schemaType: ["object"],
  validate: () => true,
});

export default ajv;
