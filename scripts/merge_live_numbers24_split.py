"""One-off merge of a live-only edit discovered when comparing the deployed
site's DB (downloaded via the admin panel) against the local data/torah.db:
a Samaritan chapter split + verse split in Numbers (Bemidbar), around the
Balak/Balaam narrative (Numbers 24), done directly on the live site and never
synced back. Full diff confirmed these are the ONLY two tables that differ
(sam_chapters, verses) across all 48 shared tables between live and local.

  py -3 scripts/merge_live_numbers24_split.py            # dry-run
  py -3 scripts/merge_live_numbers24_split.py --apply     # write the merge
"""
import sqlite3
import sys

DB = 'data/torah.db'


def main(apply):
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    if not apply:
        v4361 = cur.execute("SELECT sam_ch_id, sam_number FROM verses WHERE id=4361").fetchone()
        v7049 = cur.execute("SELECT 1 FROM verses WHERE id=7049").fetchone()
        print('dry-run: verse 4361 currently sam_ch_id=%s sam_number=%s; verse 7049 %s'
              % (v4361['sam_ch_id'], v4361['sam_number'], 'ALREADY EXISTS (would conflict)' if v7049 else 'free to insert'))
        return

    # 1) make room: every book_id=4 sam_chapter numbered >=142 shifts up by 1
    cur.execute("UPDATE sam_chapters SET number=number+1 WHERE book_id=4 AND number>=142")

    # 2) insert the new chapter at 142
    cur.execute("INSERT INTO sam_chapters (book_id, number, portion_id) VALUES (4, 142, NULL)")
    new_ch_id = cur.lastrowid

    # 3) verse 4360: masoretic_text/text no longer duplicate the next verse's content
    cur.execute("UPDATE verses SET text=?, masoretic_text=? WHERE id=4360",
                ("ויחר אף בלק אל בלעם ויספק את כפיו.",
                 "וַיִּֽחַר־אַ֤ף בָּלָק֙ אֶל־בִּלְעָ֔ם וַיִּסְפֹּ֖ק אֶת־כַּפָּ֑יו."))

    # 4) verse 4361: keeps only Balak's own speech, moves into the new chapter
    cur.execute("UPDATE verses SET text=?, sam_ch_id=?, masoretic_text=?, sam_number=? WHERE id=4361",
                ("ויאמר בלק אל בלעם לקב איבי קראתי לך והנה ברכת ברוך זה שלש רגלים",
                 new_ch_id,
                 " וַיֹּ֨אמֶר בָּלָ֜ק אֶל־בִּלְעָ֗ם לָקֹ֤ב אֹֽיְבַי֙ קְרָאתִ֔יךָ וְהִנֵּה֙ בֵּרַ֣כְתָּ בָרֵ֔ךְ זֶ֖ה שָׁלֹ֥שׁ פְּעָמִֽים׃ ",
                 "10"))

    # 5) new verse 11-1: the words spoken to Balaam, split off from 4361
    cur.execute("""INSERT INTO verses (id, chapter_id, number, text, sam_ch_id, sam_number, masoretic_text)
                   VALUES (7049, 140, '11-1', ?, ?, '11', ?)""",
                ("ועתה ברח לך אל מקומך אמרתי כבד אכבדך והנה מנעך יהוה מכבוד.",
                 new_ch_id,
                 "וְעַתָּ֖ה בְּרַח־לְךָ֣ אֶל־מְקוֹמֶ֑ךָ אָמַ֙רְתִּי֙ כַּבֵּ֣ד אֲכַבֶּדְךָ֔ וְהִנֵּ֛ה מְנָעֲךָ֥ יְהוָ֖ה מִכָּבֽוֹד׃ "))

    # 6) verses 4362-4375: moved into the new chapter, sam_number cascaded +1 from 11 onward
    cascade = {4362: '12', 4363: '13', 4364: '14', 4365: '15', 4366: '16', 4367: '17',
               4368: '18', 4369: '19', 4370: '20', 4371: '21', 4372: '22', 4373: '23',
               4374: '24', 4375: '25'}
    for vid, samnum in cascade.items():
        cur.execute("UPDATE verses SET sam_ch_id=?, sam_number=? WHERE id=?", (new_ch_id, samnum, vid))

    conn.commit()
    conn.close()
    print('APPLIED: new sam_chapters id=%d (book_id=4, number=142); verses 4360-4375 + new 7049 updated'
          % new_ch_id)


if __name__ == '__main__':
    main('--apply' in sys.argv)
