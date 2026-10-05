# Service photo uploads

## Using the editor

1. Sign in as SuperAdmin or Management and open **Services**.
2. Choose **New experience**, or open an existing service and click **Edit experience**.
3. In **Photos**, click **Upload photos** and select images from your computer or phone.
4. The first photo is the main image. Use **Set as main photo**, **Replace photo**, or **Remove** to arrange the collection.
5. Click **Create experience** or **Save experience**. To show the listing on Explore, enable **Published in marketplace** and **Available to guests**.

Supports JPEG/JPG, PNG and WebP, up to 5 MiB and 20 megapixels each. A service can have one main image and 12 gallery images. Animated images and SVG uploads are not supported. Files are oriented automatically, scaled within 2000 x 2000 pixels and saved as WebP with embedded metadata removed.

Existing local image paths and approved HTTPS addresses remain supported through **Use an existing image address**. External hosts must still be allowed in SERVICE_IMAGE_HOSTS at build and runtime.

Uploads finish before Save becomes available. Saving applies the chosen main image and gallery to the service. Closing the dialog leaves the service unchanged. If an upload fails, already uploaded previews remain available to save or replace; retry the failed file. Images are public assets at their generated URLs as soon as they upload, including before a listing is published.

## Persistent storage

By default files live at `<application-root>/uploads/service-photos`, beside the root package.json hierarchy. The API serves them at `/api/service-photos/<generated-id>.webp`; they are not stored in the SQL database or the Next build folder.

Optional `SERVICE_UPLOAD_DIR` selects another persistent directory. Absolute paths are recommended on the host; relative paths resolve from the launcher's application root. The application identity needs permission to create/read files there. The directory is created on the first upload. Change this setting only with a corresponding copy of existing photos, then restart the API; otherwise previously saved image URLs will be missing.

Preserve this directory across releases and back it up along with the database. Restore both together: SQL stores the image URLs and the directory stores the files. The release ZIP intentionally excludes uploads, test fixtures and private environment files. No rebuild or restart is needed when staff add photos after installation.

Removing/replacing a photo removes its reference from that service when saved. It does not delete the old stored file, which may still be referenced elsewhere. Cancelling an edit can also leave unreferenced uploads. There is currently no automatic cleanup or storage quota; monitor hosting storage and retain files needed by other services or backups before any manual cleanup.

## Deploying to SmarterASP.NET

1. Back up the site, SQL database and photo directory. Preserve the hosted private .env and any account-specific IIS settings. Stop the site for the matched API/web update.
2. Deploy the matched `dist/server`, `.next/standalone`, root `package.json`/lockfile, `scripts`, migration definitions and `web.config` from the prepared release, preserving paths. Do not copy the workstation .env or replace/delete persistent uploads.
3. In the hosted application root, install runtime dependencies:

   ```sh
   npm ci --omit=dev --include=optional
   ```

   Sharp is now an explicit API dependency. Its platform-specific image-processing binary is installed through optional packages; do not use the old `--omit=optional` command. See [Sharp installation requirements](https://sharp.pixelplumbing.com/install/). The release is built for Windows; no host-side Next build is needed.
4. Confirm the site identity can write/read `uploads/service-photos`, or set a persistent absolute SERVICE_UPLOAD_DIR in the private hosted environment. Photo uploads add no SQL migration; if the earlier marketplace release is not installed, follow its migration 003 deployment instructions first.
5. Restart the site, check `/api/health`, and sign in as a catalog manager. Upload a photo, save the service, and confirm its main image and gallery display on Explore. Recycle the site once and confirm the same image still loads.

For a missing image, check that the configured directory still contains the file and that `/api/service-photos/<id>.webp` returns an image. For an upload failure, inspect the private API log and verify folder permissions, free storage, installed Sharp platform packages and the limits above. A proxy/IIS request-size restriction can reject a file before the API receives it. Existing startup troubleshooting remains in [SmarterASP deployment](smarterasp-upload.md).

This feature is implemented locally. Hosted upload checks and deployment still need to be completed; the earlier hosting outage is not established as resolved by local tests.