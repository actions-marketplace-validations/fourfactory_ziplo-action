const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require("fs"); // Load the filesystem module

const ziploApiHost = "https://api.dev.ziplo.fr/v1/";
const CloudFactoryApiHost = "https://ocs.dev.ziplo.fr/";

async function run() {
  try {
    console.info("Ziplo Action | Initialization");
    const organizationToken = core.getInput('organization-token');
    let version = core.getInput('version');
    const now = new Date();

    if (typeof version !== 'string' || version?.length == 0) {
      version = [now.getFullYear, now.getMonth, now.getDay].join("-");
    }

    const filename = `${github.context.payload.repository.name}-${version}.tar.gz`;

    console.info(`Ziplo Action | Filename is ${filename}`);
    console.info(`Ziplo Action | Execute tar command`);

    exec.exec(`pwd`);
    exec.exec(`ls -l`);
    exec.exec(`ls -l ..`);
    exec.exec(`tar -czvf ./${filename} ./*`);

    const stats = fs.statSync(`./${filename}`);

    const body = {
      size: stats.size,
      filename: filename
    };

    console.info(`Ziplo Action | Call Ziplo to init upload`);

    const resultInit = await fetch(ziploApiHost + 'versioning/init', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'authorization': organizationToken,
        'Content-Type': 'application/json'
      }
    });

    const dataInit = await resultInit.json();

    console.info(`Ziplo Action | Authorization OK : ${dataInit.token}`);
    console.info(`Ziplo Action | Upload on Cloud-Factory`);


    const bodyStorage = new FormData();
    const fileStream = fs.createReadStream(`./${filename}`);

    bodyStorage.append('file', fileStream, { knownLength: stats.size });
    bodyStorage.append('email', "github-actions@ziplo.fr");
    bodyStorage.append('source', "consignment");
    bodyStorage.append('store', true);
    bodyStorage.append('versioningToken', dataInit.token);

    const resultUpload = await fetch(CloudFactoryApiHost + 'versioning/upload', {
      method: 'POST',
      body: bodyStorage,
      headers: {
        'authorization': organizationToken,
        'Content-Type': 'multipart/form-data'
      }
    });
    const dataUpload = await resultUpload.json();

    console.info(`Ziplo Action | Upload finished successfully`);

    const finalResult = JSON.stringify(dataUpload, undefined, 2)
    console.log(`The final Result: ${finalResult}`);
    core.setOutput("consignment-token", dataInit.token);

    console.info("Ziplo Action | End of action");
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();