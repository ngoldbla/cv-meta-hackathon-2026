id: HX
claim: <one sentence>
primary_metric: <p95 | cvar95 | peak_density | logger_understatement>
comparisons: <[candidate, baseline], ...>
threshold: <decision rule, e.g. mean relative change <= -0.10 with 95% CI excluding 0 and Holm-adjusted p < 0.05>
test: paired Wilcoxon signed-rank + bootstrap 95% CI over holdout instances; Holm across metrics
n_holdout_instances: <n>
data: <CAGES release + manifest sha>
models: <checkpoints + sha>
notes: <anything decided in advance>
