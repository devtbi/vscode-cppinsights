#include <array>
#include <iostream>

int main()
{
    std::cout << "showcase of cpp-insights vscode extension";

    std::array<char, 10> arr = {2, 4, 6, 8, '\0', '\0', '\0', '\0', '\0', '\0'};

    for(const char& c : arr) {
        printf("c=%c\n", c);
    }

    return 0;
}
