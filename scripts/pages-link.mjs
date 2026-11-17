import { readFile, writeFile } from 'node:fs/promises';

const [file, directory] = process.argv.slice(2);
if (!/^[a-z0-9.-]+$/.test(directory)) throw new Error('Invalid Pages directory');
const link = './' + directory + '/';
const html = await readFile(file,'utf8');
if (!html.includes('href="' + link + '"') && !html.includes('href="' + directory + '/"')) {
  const entry = '<p><a href="' + link + '">Play Mall Action · GPT-6.2-Sol xhigh</a></p>';
  const result = /<\/body>/i.test(html) ? html.replace(/<\/body>/i,entry+'\n</body>') : html+'\n'+entry+'\n';
  await writeFile(file,result);
}
