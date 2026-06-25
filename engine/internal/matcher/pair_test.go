package matcher

import (
	"testing"

	"github.com/nyx-darkpool/engine/internal/order"
)

func ask(id, price, vol string) order.Order {
	return order.Order{ID: id, Side: order.Ask, Payload: order.Payload{Price: price, Volume: vol, Salt: "1"}}
}
func bid(id, price, vol string) order.Order {
	return order.Order{ID: id, Side: order.Bid, Payload: order.Payload{Price: price, Volume: vol, Salt: "1"}}
}

func TestPairOrders(t *testing.T) {
	tests := []struct {
		name   string
		orders []order.Order
		want   []matchPair
	}{
		{
			name:   "simple cross equal volume",
			orders: []order.Order{ask("a1", "100", "50"), bid("b1", "105", "50")},
			want:   []matchPair{{MakerID: "a1", TakerID: "b1"}},
		},
		{
			name:   "exact price touch crosses",
			orders: []order.Order{ask("a1", "100", "50"), bid("b1", "100", "50")},
			want:   []matchPair{{MakerID: "a1", TakerID: "b1"}},
		},
		{
			name:   "no cross: ask above bid",
			orders: []order.Order{ask("a1", "110", "50"), bid("b1", "105", "50")},
			want:   nil,
		},
		{
			name:   "no cross: unequal volume (full-fill)",
			orders: []order.Order{ask("a1", "100", "40"), bid("b1", "105", "50")},
			want:   nil,
		},
		{
			name: "FIFO: earliest crossing bid is taken",
			orders: []order.Order{
				ask("a1", "100", "50"),
				bid("b1", "105", "50"), // earliest crossing -> chosen
				bid("b2", "106", "50"),
			},
			want: []matchPair{{MakerID: "a1", TakerID: "b1"}},
		},
		{
			name: "each order used at most once",
			orders: []order.Order{
				ask("a1", "100", "50"),
				ask("a2", "100", "50"),
				bid("b1", "105", "50"),
			},
			want: []matchPair{{MakerID: "a1", TakerID: "b1"}}, // a2 finds no free bid
		},
		{
			name: "multiple independent crosses",
			orders: []order.Order{
				ask("a1", "100", "50"),
				ask("a2", "200", "10"),
				bid("b1", "100", "50"),
				bid("b2", "250", "10"),
			},
			want: []matchPair{{MakerID: "a1", TakerID: "b1"}, {MakerID: "a2", TakerID: "b2"}},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := pairOrders(tc.orders)
			if len(got) != len(tc.want) {
				t.Fatalf("pairOrders = %v, want %v", got, tc.want)
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Fatalf("pair[%d] = %v, want %v", i, got[i], tc.want[i])
				}
			}
		})
	}
}
