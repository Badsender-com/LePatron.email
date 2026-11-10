# Publishing what a feature uses, with a check

LePatron's AI features call skills and read expertises. Publishing a new version of one of them changes what the feature produces, at once. Before publishing a version a feature uses, LePatron **replays test cases** with the active version, then with the new one, and shows you both answers side by side. A difference warns you, it never blocks: you decide.

For **super admins** only, in **Settings › Super admin › Skills & Expertise**.

## Used by a feature

LePatron knows which skills and expertises a feature uses: each feature declares the skills it calls and the expertises it loads. Nothing is set by hand, so nothing can be forgotten.

- In the **Skills** and **Expertise** tabs, the **Used by a feature** badge shows beside the title.
- The **Used by a feature** box, above the table, keeps only those items.
- On a skill's or an expertise's page, under the title: **Used by the features**, then their names, or **No feature uses it.**

An expertise is used when a feature names it, or when its filters load it: changing an expertise's category or scope can change what uses it. An **archived** item is never used: a feature loads active versions only. Publishing it again makes it active: its publication goes through the check, as if it were used.

## A feature skill's test cases

A **test case** is an input a feature skill is checked against before a publication. It lives in the skill's version: it travels with it in an export and when a copy follows production. A task skill has no test case, as no feature calls it.

### Writing a test case

1. Open the skill, **Versions** tab, then its **draft**: a published version does not change. If there is none, create a new minor version.
2. In the **Test cases** section, click **Add a test case** and fill in:
   - **Name**: what the case stands for, for example "Winter sale";
   - **Input (JSON)**: a JSON object with the fields of the version's input schema;
   - **What a good output must contain**: what the person reading the comparison should find in the answer;
   - **Notes**, if needed.
3. **Confirm the case**, then **Save draft**.

The name and the input are required, and the input must be a JSON object, between braces.

### From a playground run

A successful playground run can become a test case: open the run's details and click **Make it a test case**. Its input, and its output as the expected output, join the cases of the skill's **open draft**. Then review the expected output on the skill's page.

If the skill has no open draft, nothing is written: create a new version from the skill's page, then try again.

## Publishing a version a feature uses

On the draft, **Publish** first opens the usual confirmation (**Activate this version**). If no feature uses the version, it is published. Otherwise, the **Check before publishing** dialog opens:

- **Used by:** the features concerned;
- the number of **AI calls**, with the AI engine of the platform group: two per case, one with the active version, one with the new one, and only one for a skill that has no active version yet;
- **60 calls at most:** the cases past that cap are not replayed, and the dialog says how many. Read them again;
- **No test case, so not checked:** the feature skills concerned that have no case. They will not be checked: read them again.

Before this dialog opens, LePatron checks what costs nothing: a draft changed since the page read it, a major version without a changelog and release notes, a schema missing from the code. A publication refused anyway is refused at once, without any AI call.

Click **Run the check**. The calls run three at a time at most.

### Reading the replay

For each case, its name, the skill, **What a good output should hold** when the case says it, and two answers side by side: **Active version** and **This version**.

- **Same output**: the new version answers the same.
- An answer that breaks the contract, an input that no longer follows the input schema, or a failed AI call shows instead of the answer, as a difference.
- **Not published yet**: the skill has no active version yet, so there is no "before".

The summary says how many cases were replayed, and how many show a difference. A different answer is not necessarily a problem: it is for you to judge whether the new one is better.

### Deciding

- **Publish**, or **Publish despite the differences** if there are some: the version is published.
- **Cancel the publication**: the version stays a draft.

Either way, the decision is recorded on the version, with the person, the date, the number of cases, of differences and of cases not replayed, and the skills without a case, as LePatron found them during the check. Closing the dialog without choosing records nothing.

The check holds for the version as it was, for you, for an hour. If the draft changes meanwhile, in another tab or through an assistant, the publication is refused: reload the page and run the check again.

## Changing what a feature uses without publishing

Some changes make a feature stop, or start, using an item without any version being published. They replay nothing, but LePatron says so and keeps them on the item, with the person and the features concerned:

- **Changing the scope or the category of an active expertise**: on saving, the message says which features no longer load it, or now load it.
- **Archiving an expertise in use**: the archive dialog says which features will no longer load it.
- **Archiving a skill a feature calls**: the archive dialog says so, and **I confirm that these features will no longer call this skill.** must be ticked before archiving.

## Publishing several drafts at once

1. In the **Skills** or **Expertise** tab, tick the items. An item never published can be ticked too.
2. In the bar above the table, click **Publish the drafts**.
3. The dialog lists the drafts to publish, and the items **left out**, with the reason:
   - **no draft**;
   - **several drafts** (say a 1.3 and a 2.0): publish the one you choose from its page;
   - **archived**: reactivate it from its page;
   - **not found**;
   - what would refuse its publication anyway, such as a **major version** without a changelog and release notes, or a draft **changed since it was read**. It is left out before the check, which makes no call for it.
4. If a feature uses one of the drafts, **one check** covers the whole batch: each case is replayed once, with the active versions, then with every draft of the batch in place. It reads as for one version. Otherwise, the dialog says so: the drafts publish without a check.
5. **On a copy**, the dialog offers **Keep on this copy**, ticked at first, for the whole batch, as the publication of one version does.
6. The drafts are published **one by one**, each with the changelog and release notes of its draft. The **Publication report** says what was published, what was not and why, and everything that was left out. One failure does not stop the others.

A major version needs a changelog and release notes: without them, it is not published. Fill them in on its page, then try again.

A batch holds only skills, or only expertises: it starts from the tab of one or the other. When a skill and the expertise it reads change together, publish **the expertise first**, then the skill: the skill's check then replays its cases with the expertise already published.
