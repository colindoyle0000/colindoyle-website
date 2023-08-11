---
title: Research Assistant Assignments
profile: false
share: false
show_date: false
---

This page is periodically updated to include descriptions of the current projects that I am working on, and descriptions of the current research assistant assignments within each project.

# Legal Reasoning with Large Language Models

## Basic idea
By creating a chain of prompts that mimic the reasoning processes that a human lawyer would go through to answer a legal question, we can create software powered by large language models that greatly outperforms large language models’ ability to answer legal questions, avoids common pitfalls of large language models, and is much more transparent about its reasoning (which can help with human oversight).

## More detailed description
When we use large language models to answer legal questions, a few systemic errors crop up:
- Jumbled or incomplete reasoning
- Misapprehension of correct legal issues
- “Leakage” When answering a legal question, LLMs will often bring in material from semantically similar but conceptually distinct areas of law. For example, when one legal rule addresses a concern that is shared by other legal rules (e.g., “foreseeability” in torts relates to both duty and proximate cause), the language models will incorrectly bring in elements from those other legal rules.
- Strong confidence in clearly incorrect answers
 
This is a fundamental problem for any work that will involve using large language models to answer legal questions. As I see it, the root of this problem is an overreliance on semantic similarity in lieu of structured thinking and structured organization of information. It’s been astonishing and remarkable that large language models can achieve so much when they’re just incredibly powerful “predict the most likely next word” machines. But LLM’s lack an understanding of anything other than the semantic similarities between words. LLM’s don’t reason through tasks or mimic the behavior of legal thinking. Semantic similarity is sometimes sufficient to answer a legal question correctly even though the process sidesteps actual legal analysis. But this power is limited to the model having been trained on many similar examples of that legal question. LLMs are great mimics and impersonators. But on their own, they’re not structured thinkers.

Our big experiment with this project is to see if we can improve LLM's performance on legal questions by structuring their thinking.

## Current research assistant assignments

### Assignment: Get training materials

At this point in time, I primarily need assistance developing the background legal information that an LLM can draw upon to answer legal questions.

I’d like to have one or two research assistants work with reference librarians to find the best options for training material for our model to be able to process and reorganize.

Features to look out for in bar prep materials:

- machine readable
    - Format: bulk text files and html files would be ideal, pdf’s also okay, proprietary formats bad, scanning books is not fun but can be done
    - Text arrangement: call out boxes and columns are a pain to deal with
- organized in a hierarchical way (as in proper headings and subheadings based on how one would navigate / think through a legal issue)
- text is labeled for “rules” “issues to spot” etc.
- succinct, not filled with lots of extraneous information


### Assignment: Get bar testing materials

Once we've built our application, we need to test its performance. The most straightforward way to do this is to have the program take past bar exams. If it does exceptionally well on the bar exam (fingers crossed), then we have a direct measure of the success the project by comparing our application’s performance on the bar with plain old ChatGPT’s performance on the bar.

For this assignment, I need one or two research assistants to gather bar testing materials (relying on reference librarians for help)

Here are my suggested steps:

- Find out what material has been used on previous evaluations of ChatGPT and other LLMs
  - https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4389233
  - https://law.stanford.edu/2023/04/19/gpt-4-passes-the-bar-exam-what-that-means-for-artificial-intelligence-tools-in-the-legal-industry/
  - https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4441311
- Get that same material
    - See if authors of previous papers have made that material public
    - Else, reach out to the authors of the previous papers to see if they can give us a copy of what they used
    - Else, work with reference librarians to get that material
        - Preferably in a digital format that we can have the software easily read
- Evaluate what other testing material may be worth getting
    - If not too difficult, go get that material

## Upcoming research assistant assignments

### Clean up training materials
Assignment details TBD.

### Clean and code bar testing materials
Assignment details TBD.