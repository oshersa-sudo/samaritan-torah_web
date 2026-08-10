# Live footage

Drop the **licensed** clips here with these names, then run `bash live.sh`:

| file | scene | seconds | what it shows |
|---|---|---|---|
| `sofa.mp4`     | 1 | 0.0 – 3.6  | children sprawled on a sofa, faces in their phones |
| `night.mp4`    | 2 | 3.6 – 7.2  | a child in the dark, the phone lighting their face |
| `meeting.mp4`  | 3 | 7.2 – 12.4 | a parent and child facing a teacher |
| `together.mp4` | 5 | 27.2 – 31.4| two children delighted over one screen |

Requirements: at least 1080×1920, or 1920×1080 and the script will cover-crop
it. At least a second longer than the slot. 25 or 30 fps. No burnt-in captions
or logos.

**A licence that permits advertising is required.** Preview and comp files —
iStock's `..._adpp_is.mp4`, Getty comps, Shutterstock previews — carry a
watermark and are for evaluation only; they cannot be used in a published
advert. Clips marked *Editorial Use Only* cannot either, whatever the
resolution.

`live.sh` reads the paths from variables at the top; point them at these files.
Scenes 4 (the app) and 6 (the logo) are not footage and are never replaced.
