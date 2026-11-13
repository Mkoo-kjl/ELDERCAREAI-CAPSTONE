# ElderCareAI website

Open `index.html` directly in a browser. The landing page is static and separate from the Expo app.

For a Git-based Vercel deployment, set the project root directory to `website` and use the `Other` framework preset. The admin portal at `/edcadmin/` requires the committed `edcadmin/config.js` public configuration file; see [admin setup](edcadmin/README.md). After deployment, check that `/edcadmin/config.js` returns JavaScript, not a 404.

## Android app installation

The public landing page has an Install or try the app section at `/#install`, linked from the hero and both navigation menus. The installation promotion appears only on the public landing page. The supplied download is https://drive.google.com/file/d/1znHl4gWYmZKK5F0QYAa3rkPlsxYoMsI8/view?usp=sharing. Keep its Google Drive access available to intended testers; this repository does not host the APK binary. Replace the APK link in `index.html` when publishing a new download.

The recommendation is Best with Galaxy Watch6. The Android phone APK and Wear OS companion are separate installations. Trying the phone app uses the tester's own caregiver account and does not create sample medical records.

## Team photos

The three team cards use the supplied portraits in `assets/team/`: `kristoffer.png` (member 2, Kristoffer James G. Layos), `melvence.jpg` (member 1), and `john-wayne.jpg` (member 3). Photo areas stay square (1:1) on desktop and mobile, with cover cropping aligned to the top to keep heads fully visible. The initials remain behind the photo as a fallback.

## Contact details

The supplied addresses ended with `@gmail`. The site uses `@gmail.com` so the email links work. Confirm these addresses before publishing.

## Images

The logo, favicon, user-supplied Galaxy Watch6 photo, and Inter font files are copied from the app's existing assets/dependencies. The two hero photographs were created with the built-in image generation tool for this website. Their prompts describe a candid Filipino older adult and caregiver in a softly lit home, with the people on the right in the desktop composition and lower in the mobile composition so the page title remains readable. The imagery is illustrative, not a photograph of a patient or team member.
