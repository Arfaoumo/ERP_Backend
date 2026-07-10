const fs = require('fs');
const path = require('path');

const deleteLocalUpload = async (uploadPath) => {
  if (typeof uploadPath !== 'string' || !uploadPath.startsWith('/uploads/')) return;
  const uploadRoot = path.resolve(process.cwd(), 'uploads');
  const resolved = path.resolve(process.cwd(), uploadPath.replace(/^\/+/, ''));
  if (!resolved.startsWith(`${uploadRoot}${path.sep}`)) return;

  try {
    await fs.promises.unlink(resolved);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error(`Unable to delete old upload: ${error.message}`);
  }
};

module.exports = { deleteLocalUpload };
