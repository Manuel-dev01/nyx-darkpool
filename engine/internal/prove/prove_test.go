package prove

import (
	"testing"

	"github.com/nyx-darkpool/engine/internal/order"
)

func TestInputForMapsFields(t *testing.T) {
	maker := order.Order{
		Commitment: "MAKERHASH",
		Payload:    order.Payload{Price: "100", Volume: "50", Salt: "111111"},
	}
	taker := order.Order{
		Commitment: "TAKERHASH",
		Payload:    order.Payload{Price: "105", Volume: "50", Salt: "222222"},
	}
	in := InputFor(maker, taker)
	want := Input{
		MakerHash: "MAKERHASH", TakerHash: "TAKERHASH",
		MakerPrice: "100", TakerPrice: "105",
		MakerVolume: "50", TakerVolume: "50",
		MakerSalt: "111111", TakerSalt: "222222",
	}
	if in != want {
		t.Fatalf("InputFor = %+v, want %+v", in, want)
	}
}

func TestNewMissingArtifacts(t *testing.T) {
	// A directory with no compiled circuit must produce a descriptive error, not
	// a panic — the server uses this to run with proving disabled.
	_, err := New(Config{CircuitsRoot: t.TempDir(), ScriptsRoot: t.TempDir()})
	if err == nil {
		t.Fatal("expected error for missing circuit artifacts, got nil")
	}
}
