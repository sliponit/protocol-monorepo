# Stream Butler

## Prerequisites
In order to run this project, you need to have the following dependencies installed on your computer:

- [foundry](https://github.com/foundry-rs/foundry)
- [yarn](https://yarnpkg.com/getting-started/install)

## Setup
To set up the project run the following command:
```
make
```

This runs the `all:` command which does the following:

- `clean`: removes the `/out` and `/cache` files that are generated when you run `forge build`
- `install`: installs the required modules and generates the remappings.txt file for VSCode integration
- `update`: updates dependencies
- `solc`: installs the specified solc version
- `build`: builds the contracts