export async function fileToKnowledgePayload(file) {
  const name = file.name.toLowerCase();
  const isBinaryDocument = ['.pdf', '.docx', '.doc', '.xlsx'].some(extension => name.endsWith(extension));
  if (!isBinaryDocument) return { content: await file.text(), title: file.name, fileType: name.split('.').pop(), metadata: {}, source_file: file.name };
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return { content: btoa(binary), title: file.name, fileType: name.split('.').pop(), metadata: {}, source_file: file.name };
}
