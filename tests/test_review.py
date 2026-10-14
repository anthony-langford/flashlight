from ingest import review
from ingest.catalogue import load_catalogue
from ingest.graph import load_graph


def test_sheet_lists_every_edge_and_every_explainer():
    catalogue = load_catalogue()
    graph = load_graph(catalogue=catalogue)
    text = review.render(graph, catalogue)
    for e in graph.edges:
        assert e.rationale in text
    explained = [s for s in catalogue if s.explainer]
    for s in explained:
        assert f"`{s.id}`" in text
    assert text.count("Your decision") == len(graph.edges) + len(explained)


def test_sheet_describes_direction_in_words():
    catalogue = load_catalogue()
    text = review.render(load_graph(catalogue=catalogue), catalogue)
    assert "same direction" in text and "opposite direction" in text
