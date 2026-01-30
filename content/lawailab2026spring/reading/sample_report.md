---
# Title, summary, and page position.
linktitle: Sample Experiment Report
summary: Sample report for February 4 experiment.
weight: 30
# icon: floppy-disk
# icon_pack: fas
# Page metadata.
title: Sample Experiment Report
date: '2022-08-16T00:00:00Z'
type: book # Do not modify.
toc: false
draft: false
---

# Racial Bias in Language Models’ Sentencing Decisions

## Research Question
Do language models display racial biases similar to those observed in human legal actors when making sentencing decisions?

## Hypothesis
If a language model is prompted to act as a state trial-court judge imposing a sentence within sentencing guidelines, then the sentence it recommends will vary based on the perceived race of the defendant. Holding all other facts constant, I expect the model to recommend longer sentences for defendants with names stereotypically associated with Black men than for defendants with names stereotypically associated with white men.

## Experimental Design

### Language Model
I plan to use Grok (free account) through the chat interface. Because chat interfaces may incorporate prior conversational context, I will run the experiment in incognito mode and refresh between trials.

### Task definition
The task is a sentencing recommendation. The model is instructed to play the role of a state court judge who must impose a sentence within the bounds of state sentencing guidelines. The model is given a fixed fact pattern (based on an actual sentencing case) and asked to recommend a sentence.

### Independent variable
The only variable that changes across conditions is the defendant’s name, used as an implicit cue for perceived race.

Condition A (white-coded names): 5 trials with stereotypically white male names:

Todd O’Brien

Neil Sullivan

Geoffrey Walsh

Brett Murphy

Brendan Ryan

Condition B (Black-coded names): 5 trials with stereotypically Black male names:

Jamal Washington

Hakim Jackson

Jermaine Williams

Kareem Jones

Darnell Robinson

The names were taken from prior research on name-based racial cues in hiring discrimination studies (Bertrand & Mullainathan, 2004). https://www.nber.org/papers/w9873

Everything else in the prompt and fact pattern is identical across trials.

### Dependent variable
The primary outcome is sentence severity measured as months of incarceration.

### Protocol
I plan to use the same prompt template for all 10 trials. 


### Limitations and Future Directions


**Single-model limitation** This prototype tests only Grok. I chose Grok because it has faced public accusations of bias, so if any model is biased, it’s probably Grok. But these findings would not generalize to LLMs broadly. A stronger study would test multiple models.

**Single-vignette limitation** Using one case vignette makes this very sensitive to quirks of the fact pattern. A stronger study would include multiple vignettes across offense types and guideline ranges. A stronger study might also vary legal context to see if bias appears more in discretionary contexts. Perhaps the testing material should include civil cases or lower-stakes decisions as well.

**Implying race through names**
Using names as an implicit cue may interact with model safety systems in unpredictable ways. A stronger study would vary how race is signaled.

This matters because the model may behave differently the more that race is explicit. It is possible that explicit race cues trigger guardrails that have been imposed on chatbots to suppress biased outputs, while certain kinds of implicit cues bypass those guardrails. If so, a finding of a lack of bias under certain cues would not necessarily mean the absence of bias.

**Guardrails and refusals in a high-stakes domain**
Sentencing is a high-stakes legal decision and may activate safety behavior for some models, including refusal. A stronger design would also test lower-stakes legal decisions to see whether any disparities appear more clearly outside guardrail-heavy contexts.

**Randomness and repeatability**
A chat model’s output can vary across runs even with identical prompts. This prototype uses 5 trials per condition, but a stronger study would increase the number of runs per vignette.

**Measurement limitations**
Using the quantitative measure of “months” for a sentence is simple but incomplete. Sentencing decisions often include reasoning. A stronger study would pair the quantitative outcome with a coding scheme for qualitative differences in reasoning and tone behind the sentence. This also raises reliability challenges for analysis (like what counts as “harsher” reasoning?), so this would take some careful planning.

**Connection to literature**
This prototype is motivated by research into racial disparities in sentencing and implicit bias in legal decision-making, but a stronger study might review psychological and empirical sentencing-bias research and then adapt or replicate established designs with machine “subjects” as replacements for the human subjects of the original studies.