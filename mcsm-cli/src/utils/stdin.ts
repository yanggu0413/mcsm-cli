export async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let content = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => {
      content += chunk;
    });
    process.stdin.on('end', () => {
      resolve(content);
    });
    process.stdin.on('error', (err) => {
      reject(err);
    });
  });
}
