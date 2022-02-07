#include <array>
#include <atomic>
#include <iostream>

template <typename F>
class Call final
{
public:
    F const f_;
    Call(F const f) : f_{f} {}
};

int main()
{
    std::atomic<int> x{int{2}};
    auto f{
        [&x]()
        {
            x = 2;
            return;
        }};

    Call<decltype(f)> k{std::move(f)};

    return 0;
}
