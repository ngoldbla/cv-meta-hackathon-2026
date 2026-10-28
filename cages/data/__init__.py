"""CAGES data: instances (frozen), stock, features, labels and the generator.

``instances`` is imported lazily so that stock and feature code can load on their own."""


def __getattr__(name):
    if name in ("build_scenario", "holdout_specs", "lower_bound_clearance", "make_specs"):
        from . import instances

        return getattr(instances, name)
    raise AttributeError(name)


__all__ = ["build_scenario", "holdout_specs", "lower_bound_clearance", "make_specs"]
