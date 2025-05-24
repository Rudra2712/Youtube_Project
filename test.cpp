#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int T;
    cin >> T;
    const string VOWELS = "aeiou";

    while (T--) {
        int n;
        cin >> n;
        int baseCount = n / 5;       
        int extra    = n % 5;       
        for (int i = 0; i < 5; ++i) {
            int times = baseCount + (i < extra ? 1 : 0);
            for (int k = 0; k < times; ++k) {
                cout << VOWELS[i];
            }
        }
        cout << "\n";
    }
    return 0;
}
