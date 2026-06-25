package order

import "testing"

func TestEncodeDecodeRoundTrip(t *testing.T) {
	in := Payload{Price: "100", Volume: "50", Salt: "111111"}
	b, err := Encode(in)
	if err != nil {
		t.Fatalf("Encode: %v", err)
	}
	out, err := Decode(b)
	if err != nil {
		t.Fatalf("Decode: %v", err)
	}
	if out != in {
		t.Fatalf("round trip = %+v, want %+v", out, in)
	}
}

func TestEncodeRejectsNonInteger(t *testing.T) {
	cases := []Payload{
		{Price: "1.5", Volume: "50", Salt: "1"},
		{Price: "100", Volume: "abc", Salt: "1"},
		{Price: "100", Volume: "50", Salt: ""},
	}
	for _, c := range cases {
		if _, err := Encode(c); err == nil {
			t.Errorf("Encode(%+v) = nil error, want rejection", c)
		}
	}
}

func TestPayloadInts(t *testing.T) {
	p := Payload{Price: "105", Volume: "50", Salt: "7"}
	pi, ok := p.PriceInt()
	if !ok || pi.Int64() != 105 {
		t.Fatalf("PriceInt = %v, %v", pi, ok)
	}
	vi, ok := p.VolumeInt()
	if !ok || vi.Int64() != 50 {
		t.Fatalf("VolumeInt = %v, %v", vi, ok)
	}
}

func TestSideValid(t *testing.T) {
	if !Bid.Valid() || !Ask.Valid() {
		t.Fatal("Bid/Ask should be valid")
	}
	if Side("buy").Valid() {
		t.Fatal(`"buy" should be invalid`)
	}
}
