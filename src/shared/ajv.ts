import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true, strictSchema: false });
addFormats(ajv);

["inputType", "label"].forEach((keyword) => {
  ajv.addKeyword({
    keyword,
    schemaType: ["string"],
    validate: () => true,
  });
});

export default ajv;
